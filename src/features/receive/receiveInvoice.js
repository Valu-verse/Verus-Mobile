/*
  Shared receive invoice helpers
  - Normalizes numeric input and validates amount/slippage fields
  - Generates VerusPay invoices (v0 / v2) given sanitized form data
*/

import BigNumber from 'bignumber.js';
import { coinsToSats, isNumber } from '../../utils/math';
import { createVerusPayInvoice } from '../../utils/api/channels/vrpc/callCreators';
import VerusPayParser from '../../utils/verusPay/index';
import { primitives } from 'verusid-ts-client';
import { fromBase58Check } from 'verus-typescript-primitives';
import { I_ADDRESS_VERSION, R_ADDRESS_VERSION } from '../../utils/constants/constants';
import { coinsList } from '../../utils/CoinData/CoinsList';

const DEFAULT_SLIPPAGE_PERCENT = '0.5';

export const sanitizeNumericInput = (numericString) => {
  if (numericString == null) return '';
  return numericString.toString().replace(/,/g, '.');
};

export const validateAmountInput = (sanitizedAmount) => {
  if (!sanitizedAmount || sanitizedAmount.length === 0) return null;
  if (!isNumber(sanitizedAmount)) return 'Please enter a valid number.';
  if (Number(sanitizedAmount) <= 0) return 'Enter an amount greater than 0.';
  return null;
};

export const validateSlippageInput = (sanitizedSlippage) => {
  if (!sanitizedSlippage || sanitizedSlippage.length === 0) return null;
  if (!isNumber(sanitizedSlippage)) return 'Please enter a valid percentage.';
  const value = Number(sanitizedSlippage);
  if (value <= 0 || value > 100) return 'Slippage must be greater than 0 and not exceed 100%.';
  return null;
};

export const generateReceiveInvoice = async ({
  coinObj,
  subWallet,
  address,
  amountValue,
  amountFiat,
  memo,
  allowConversion,
  maxSlippageValue,
  displayCurrency,
  priceMap,
}) => {
  if (!coinObj) throw new Error('Missing coin.');
  if (!subWallet) throw new Error('Missing wallet.');
  if (!address) throw new Error('Missing address.');

  const sanitizedAmount = amountValue && amountValue.length > 0 ? amountValue : '0';
  let amountCryptoString = sanitizedAmount;

  if (amountFiat) {
    const price = priceMap ? priceMap[displayCurrency] : null;
    if (!price || Number(price) <= 0) {
      throw new Error(`Unable to convert ${displayCurrency} to ${coinObj.display_ticker}.`);
    }
    amountCryptoString = BigNumber(sanitizedAmount).dividedBy(BigNumber(price)).toString();
  }

  const conversionEligible = coinObj.proto === 'vrsc' && subWallet.id !== 'PRIVATE_WALLET';
  const amountIsZero = sanitizedAmount.length === 0 || Number(sanitizedAmount) === 0;

  if (conversionEligible) {
    const { hash, version } = fromBase58Check(address);
    let destinationType;

    if (version === I_ADDRESS_VERSION) destinationType = primitives.DEST_ID;
    else if (version === R_ADDRESS_VERSION) destinationType = primitives.DEST_PKH;
    else throw new Error('Unsupported address format for invoice.');

    const verusSystem = coinObj.testnet
      ? coinsList.VRSCTEST.currency_id
      : coinsList.VRSC.currency_id;
    const networkId = subWallet.network;
    const nonVerusSystems = networkId && networkId === verusSystem ? [] : networkId ? [networkId] : [];

    const amountBN = new primitives.BigNumber(
      coinsToSats(BigNumber(amountCryptoString || 0)).toString(),
      10,
    );
    const amountGtZero = amountBN.gt(new primitives.BigNumber(0));
    const acceptsConversion = allowConversion && !amountIsZero;

    const slippagePercent = maxSlippageValue && maxSlippageValue.length > 0
      ? maxSlippageValue
      : DEFAULT_SLIPPAGE_PERCENT;

    const invoice = await createVerusPayInvoice(
      coinObj,
      new primitives.VerusPayInvoiceDetails({
        amount: amountGtZero
          ? new primitives.BigNumber(
              coinsToSats(BigNumber(amountCryptoString)).toString(),
              10,
            )
          : undefined,
        destination: new primitives.TransferDestination({
          type: destinationType,
          destination_bytes: hash,
        }),
        requestedcurrencyid: coinObj.currency_id,
        acceptedsystems: nonVerusSystems,
        maxestimatedslippage: acceptsConversion
          ? new primitives.BigNumber(
              coinsToSats(BigNumber(slippagePercent).dividedBy(100)).toString(),
              10,
            )
          : undefined,
      }),
    );

    invoice.details.setFlags({
      acceptsConversion,
      isTestnet: !!coinObj.testnet,
      acceptsNonVerusSystems: nonVerusSystems.length > 0,
      acceptsAnyAmount: !amountGtZero,
    });

    return {
      qrString: invoice.toWalletDeeplinkUri(),
      showVerusIcon: true,
    };
  }

  return {
    qrString: VerusPayParser.v0.writeVerusPayQR(coinObj, amountCryptoString, address, memo),
    showVerusIcon: false,
  };
};


