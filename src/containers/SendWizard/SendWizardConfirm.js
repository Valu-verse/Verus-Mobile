/*
  SendWizardConfirm
  - Step 5: Overview and confirmation of transaction
  - Runs preflight to validate and get fee info
  - Shows summary including fees, conversion rates, warnings
  - Created 2024-12-09
  - Updated 2024-12-15: Redesigned with cleaner layout, GradientButton,
    proper fee display, navigates to success screen on completion
  - Updated 2024-12-17: Made amount section more compact - reduced padding,
    font sizes, logo sizes, and spacing for better screen utilization
  - Updated 2024-12-17: Added estimated time until arrival based on transaction type
    ETH/ERC20 conversions and cross-chain: 1-3 hours, Verus conversions: 2-10 minutes,
    Simple sends: 1-5 minutes. Not shown for preconvert transactions
  - Updated 2024-12-17: Fixed VerusID resolution for ETH/ERC20 by using the getIdentity
    router which correctly maps to the VRPC system (was using .eth as system ID)
  - Updated 2026-01-06: Confirm screen now prefers the preflight estimate (more accurate)
    but falls back to the wizard estimate (often derived from path.price). Avoids showing
    "no estimate" warnings when a fallback estimate exists.
  - Updated 2026-01-06: Preflight now uses preflight-friendly names (FQNs) captured during
    target selection (convertToFqn/exportToFqn), matching the legacy send modal and avoiding
    getCurrency failures when passing i-addresses for some PBaaS systems.
  - Updated 2026-01-15: Added a header close X that disables while sending.
  - Updated 2026-01-15: Removed duplicate icon import causing a redeclare error.
  - Updated 2026-01-15: Pass full preflight payload for simple sends so
    VRPC has hex/inputs available during send.
  - Updated 2026-01-21: Added fiat currency display for send amount and network fee.
    Shows user's preferred fiat currency (e.g., USD) alongside crypto values.
    Updated 'From' field to show actual sending address instead of wallet name.
    Redesigned amount display: smaller icon (24px), ticker inline with amount,
    larger fiat text (15px). Limited fee decimals for cleaner ETH display.
  - Updated 2026-01-21: Fixed ERC20 network fee fiat display bug. For simple sends with
    different fee currency (e.g., ERC20 tokens paying fees in ETH), now correctly looks up
    the fee currency's coin ID for accurate fiat conversion instead of using source coin ID.
    This fixes the issue where ERC20 sends showed "€0" for network fees.
  - Updated 2026-01-21: Fixed fee currency display for bridge transfers. The ETH null
    address (0x000...000) is now recognized as "ETH" instead of showing the raw hex.
    Also improved lookup for 0x addresses to find matching coins by currency_id.
  - Updated 2026-01-21: Show higher precision for VRSC fee fiat amounts to demonstrate
    how small they are (e.g., €0.0012 instead of €0). Uses up to 4 decimals for very
    small amounts. Only applies to VRSC fees; other currencies keep standard 2 decimals.
  - Updated 2026-01-21: Fixed VRSC fee fiat formatting to preserve locale separators
    and currency placement. Avoids incorrect outputs like "00.0002".
  - Updated 2026-01-21: Added info icons ("?") next to estimated time and network fee
    for bridge transactions. Tapping opens info sheets explaining why bridge transactions
    take 1-3 hours and why ETH gas fees are higher.
  - Updated 2026-01-21: Added fiat display for estimated receive amount.
    Added help icon for estimated receive amount explaining it's an estimate.
    Added hourglass icon for PBaaS conversions (2-10 mins) alongside bridge transactions.
    Added info sheet for PBaaS conversion time estimates (2-10 mins) explaining block bundling.
    Updated explanation text for estimated receive amount help sheet.
    Redesigned amount section: left-aligned modern layout, divider with arrow circle,
    "Estimated" badge for receive amount. Cleaner visual hierarchy.
    Added conversion fee display for DeFi conversions (0.025% direct, 0.05% via).
    Fee is shown as a separate row with percentage and note that it's included in amount.
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, Button, Portal } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { formatCurrency } from 'react-native-format-currency';
import Colors from '../../globals/colors';
import BigNumber from 'bignumber.js';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSendWizard } from './SendWizardContext';
import { preflightConvertOrCrossChain } from '../../utils/api/routers/preflightConvertOrCrossChain';
import { preflightSend } from '../../utils/api/routers/preflightSend';
import { sendConvertOrCrossChain } from '../../utils/api/routers/sendConvertOrCrossChain';
import { send } from '../../utils/api/routers/send';
import { coinsToSats, satsToCoins } from '../../utils/math';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { expireCoinData } from '../../actions/actionCreators';
import { API_GET_BALANCES, API_GET_TRANSACTIONS, API_GET_FIATPRICE, VRPC, ETH, ERC20, ELECTRUM, GENERAL, WYRE_SERVICE, USD } from '../../utils/constants/intervalConstants';
import {
  DEST_PKH,
  DEST_ID,
  DEST_ETH,
  TransferDestination,
  fromBase58Check,
  I_ADDRESS_VERSION,
  R_ADDRESS_VERSION,
} from 'verus-typescript-primitives';
import { ethers } from 'ethers';
import { getIdentity } from '../../utils/api/routers/getIdentity';
import { getCurrencyDisplayName, getNetworkDisplayName } from './sendWizardDisplayInfo';
import GradientButton from '../../components/GradientButton';
import BridgeEstimatedTimeInfoSheet from './components/BridgeEstimatedTimeInfoSheet';
import BridgeFeeInfoSheet from './components/BridgeFeeInfoSheet';
import ConversionReceiveInfoSheet from './components/ConversionReceiveInfoSheet';
import PbaasEstimatedTimeInfoSheet from './components/PbaasEstimatedTimeInfoSheet';

const SendWizardConfirm = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { state, setPreflight, setLoading, reset, setTxResult } = useSendWizard();
  const {
    sourceCoin,
    sourceSubWallet,
    sourceBalance,
    targetCurrency,
    exportTo,
    isConversion,
    isCrossChain,
    mapTo,
    targetDisplayName,
    targetDisplayTicker,
    convertToFqn,
    exportToFqn,
    amount,
    amountSats,
    via,
    viaOptions,
    preconvert,
    recipientAddress,
    preflightResult,
    channel,
    estimate,
  } = state;

  const activeAccount = useObjectSelector((s) => s.authentication.activeAccount);

  // Fiat display currency and rates
  const displayCurrency = useSelector(
    (s) => s.settings.generalWalletSettings.displayCurrency || USD,
  );
  const rates = useObjectSelector((s) => s.ledger.rates);

  const [loading, setLocalLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [estimatedTimeInfoVisible, setEstimatedTimeInfoVisible] = useState(false);
  const [feeInfoVisible, setFeeInfoVisible] = useState(false);
  const [conversionReceiveInfoVisible, setConversionReceiveInfoVisible] = useState(false);
  const [pbaasTimeInfoVisible, setPbaasTimeInfoVisible] = useState(false);

  const handleClose = useCallback(() => {
    if (sending) return;
    const parent = navigation.getParent?.();
    if (parent && typeof parent.goBack === 'function') {
      parent.goBack();
      return;
    }
    navigation.goBack();
  }, [navigation, sending]);

  const renderCloseButton = useCallback(() => {
    const disabled = sending;
    return (
      <TouchableOpacity
        onPress={disabled ? undefined : handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        accessibilityState={{ disabled }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        disabled={disabled}
        style={[styles.headerCloseButton, disabled && styles.headerCloseButtonDisabled]}
      >
        <MaterialCommunityIcons
          name="close"
          size={22}
          color={disabled ? '#A0A0A0' : Colors.verusDarkGray}
        />
      </TouchableOpacity>
    );
  }, [handleClose, sending]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: renderCloseButton,
      headerBackTitle: 'Back',
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: 'white',
        elevation: 0,
        shadowOpacity: 0,
      },
    });
  }, [navigation, renderCloseButton]);

  // Determine if this is a simple send or convert/cross-chain
  const isSimpleSend = useMemo(() => {
    return !isConversion && !isCrossChain && !exportTo;
  }, [isConversion, isCrossChain, exportTo]);

  const channelType = useMemo(() => {
    if (!channel) return null;
    return channel.split('.')[0];
  }, [channel]);

  // Get rate for a specific coin (checks WYRE_SERVICE first, then GENERAL)
  const getRate = useCallback(
    (coinId) => {
      if (!coinId) return null;
      return rates?.[WYRE_SERVICE]?.[coinId]?.[displayCurrency] != null
        ? rates[WYRE_SERVICE][coinId][displayCurrency]
        : rates?.[GENERAL]?.[coinId]?.[displayCurrency] != null
          ? rates[GENERAL][coinId][displayCurrency]
          : null;
    },
    [rates, displayCurrency],
  );

  // Format crypto amount to fiat display string
  const formatFiat = useCallback(
    (cryptoAmount, coinId) => {
      const rate = getRate(coinId);
      if (!rate || !cryptoAmount) return null;
      try {
        const fiatValue = BigNumber(cryptoAmount).multipliedBy(BigNumber(rate));
        if (fiatValue.isNaN() || !fiatValue.isFinite()) return null;
        const [formatted] = formatCurrency({
          amount: fiatValue.decimalPlaces(2, BigNumber.ROUND_HALF_UP).toNumber(),
          code: displayCurrency,
        });
        return formatted;
      } catch (e) {
        return null;
      }
    },
    [getRate, displayCurrency],
  );

  // Get sending address from subwallet based on coin protocol
  const getSendingAddress = useCallback(() => {
    if (!sourceSubWallet || !sourceCoin || !activeAccount) return null;

    const proto = sourceCoin.proto;
    const coinId = sourceCoin.id;

    // ETH/ERC20: from activeAccount.keys
    if (proto === 'eth' || proto === 'erc20') {
      const keyChannel = proto === 'eth' ? ETH : ERC20;
      return activeAccount.keys?.[coinId]?.[keyChannel]?.addresses?.[0] || null;
    }

    // VRPC: from subwallet channel (format: VRPC.address.systemId)
    if (sourceSubWallet.channel) {
      const parts = sourceSubWallet.channel.split('.');
      return parts.length > 1 ? parts[1] : null;
    }

    return null;
  }, [sourceSubWallet, sourceCoin, activeAccount]);

  // Calculate estimated time until arrival based on transaction type
  const estimatedTime = useMemo(() => {
    // Don't show time estimate for preconvert transactions
    if (preconvert) return null;

    // ETH/ERC20 on-chain conversion (convertto but no exportto)
    if ((channelType === ETH || channelType === ERC20) && isConversion && !exportTo) {
      return '1-3 hours';
    }

    // Cross-chain transfer (exportto is set)
    if (isCrossChain && exportTo) {
      return '1-3 hours';
    }

    // Regular conversion on Verus (convertto but no exportto)
    if (isConversion && !exportTo) {
      return '2-10 minutes';
    }

    // Simple send (no conversion, no cross-chain)
    if (isSimpleSend) {
      return '1-5 minutes';
    }

    return null;
  }, [channelType, isConversion, isCrossChain, exportTo, isSimpleSend, preconvert]);

  // Flag to determine if this is a bridge transaction (1-3 hour estimate)
  // Used to show info icons explaining the longer time and higher fees
  const isBridgeTransaction = useMemo(() => {
    return estimatedTime === '1-3 hours';
  }, [estimatedTime]);

  const isPbaasConversion = useMemo(() => {
    return estimatedTime === '2-10 minutes';
  }, [estimatedTime]);

  // Build destination from address
  const buildDestination = useCallback(async () => {
    const addr = recipientAddress.trim();

    // VerusID
    if (addr.endsWith('@')) {
      // Use the getIdentity router which correctly routes ETH/ERC20 to the VRPC system
      const identityRes = await getIdentity(sourceCoin, activeAccount, channel, addr);

      if (identityRes.error) {
        throw new Error(`Failed to get information about ${addr}. Try using the i-address of this VerusID.`);
      }

      const keyhash = identityRes.result.identity.identityaddress;
      const { hash } = fromBase58Check(keyhash);

      return new TransferDestination({
        destination_bytes: hash,
        type: DEST_ID,
      });
    }

    // ETH address
    if (addr.startsWith('0x') && ethers.isAddress(addr)) {
      return new TransferDestination({
        destination_bytes: Buffer.from(addr.substring(2), 'hex'),
        type: DEST_ETH,
      });
    }

    // Base58 address
    try {
      const { hash, version } = fromBase58Check(addr);
      let type;

      if (version === R_ADDRESS_VERSION) type = DEST_PKH;
      else if (version === I_ADDRESS_VERSION) type = DEST_ID;
      else type = DEST_PKH; // Default

      return new TransferDestination({
        destination_bytes: hash,
        type,
      });
    } catch (e) {
      throw new Error('Invalid address format');
    }
  }, [recipientAddress, sourceCoin, activeAccount, channel]);

  // Run preflight on mount
  useEffect(() => {
    const runPreflight = async () => {
      if (!sourceCoin || !channel || !recipientAddress || !amountSats) {
        setError('Missing required transaction data');
        setLocalLoading(false);
        return;
      }

      setLocalLoading(true);
      setError(null);
      setWarnings([]);

      try {
        let result;

        if (isSimpleSend) {
          // Simple send preflight
          result = await preflightSend(
            sourceCoin,
            activeAccount,
            recipientAddress,
            BigNumber(amount),
            channel,
            {}
          );
        } else {
          // Convert/cross-chain preflight
          const destination = await buildDestination();

          const output = {
            currency: sourceCoin.currency_id || sourceCoin.id,
            address: destination,
            satoshis: amountSats,
          };

          if (isConversion && targetCurrency) {
            // Use the legacy-style name/FQN when available to avoid getCurrency failures
            output.convertto = convertToFqn || targetCurrency;
          }

          if (isCrossChain && exportTo) {
            // Use the legacy-style name/FQN when available to avoid getCurrency failures
            output.exportto = exportToFqn || exportTo;
          }

          if (via) {
            // Legacy flow passes via as a currency name/FQN (not i-address) when possible
            const viaName = viaOptions?.find((v) => v.id === via)?.name;
            output.via = viaName || via;
          }

          if (mapTo) {
            output.mapto = mapTo;
          }

          if (preconvert) {
            output.preconvert = true;
          }

          result = await preflightConvertOrCrossChain(
            sourceCoin,
            activeAccount,
            channel,
            output
          );
        }

        if (result.err) {
          throw new Error(result.result);
        }

        setPreflight(result.result);

        // Check for warnings
        const newWarnings = [];

        if (result.result.converterdef?.proofprotocol === 2) {
          newWarnings.push({
            type: 'centralized',
            message: `You are converting to a centralized currency. The controller has the ability to mint new supply.`,
          });
        }

        // Only warn when we truly have no estimate (legacy flow falls back to path.price)
        const hasFallbackEstimate = estimate?.estimatedcurrencyout != null;
        if (result.result.estimate == null && isConversion && !hasFallbackEstimate) {
          newWarnings.push({
            type: 'no_estimate',
            message: 'Could not calculate an estimated result for this conversion.',
          });
        }

        // Check for slippage between earlier estimate and preflight estimate
        if (isConversion && estimate && result.result.estimate) {
          const earlierOutput = BigNumber(estimate.estimatedcurrencyout || 0);
          const preflightOutput = BigNumber(result.result.estimate.estimatedcurrencyout || 0);
          
          if (earlierOutput.isGreaterThan(0) && preflightOutput.isGreaterThan(0)) {
            const slippage = earlierOutput.minus(preflightOutput).dividedBy(earlierOutput).multipliedBy(100);
            
            // Warn if slippage is more than 2%
            if (slippage.isGreaterThan(2)) {
              newWarnings.push({
                type: 'slippage',
                message: `Due to low liquidity, the estimated amount you will receive differs by ${slippage.decimalPlaces(1).toString()}% from the earlier estimate. Verify the new amount before continuing.`,
              });
            }
          }
        }

        // Check for amount adjustment (fee taken from amount)
        if (result.result.submittedsats && result.result.output?.satoshis) {
          const submitted = BigNumber(result.result.submittedsats);
          const actual = BigNumber(result.result.output.satoshis);
          
          if (!submitted.isEqualTo(actual)) {
            newWarnings.push({
              type: 'amount_adjusted',
              message: `Your amount was adjusted from ${satsToCoins(submitted).toString()} to ${satsToCoins(actual).toString()} to account for transaction fees.`,
            });
          }
        }

        setWarnings(newWarnings);
      } catch (e) {
        console.error('Preflight error:', e);
        setError(e.message || 'Failed to prepare transaction');
      }

      setLocalLoading(false);
    };

    runPreflight();
  }, [
    sourceCoin,
    channel,
    recipientAddress,
    amountSats,
    isSimpleSend,
    activeAccount,
    amount,
    buildDestination,
    isConversion,
    targetCurrency,
    isCrossChain,
    exportTo,
    via,
    mapTo,
    preconvert,
    setPreflight,
  ]);
  
  // Prefer the preflight estimate (more accurate). Fall back to the earlier wizard estimate.
  const displayEstimate = useMemo(() => {
    return preflightResult?.estimate || estimate || null;
  }, [preflightResult, estimate]);

  // Get currency info for display
  const getCurrencyInfo = useCallback((currencyId, optionalViaOptions = null) => {
    if (!currencyId) return { name: 'Unknown', ticker: '?', coinId: null };
    
    try {
      const coin = CoinDirectory.findCoinObj(currencyId);
      if (coin) return { name: coin.display_name, ticker: coin.display_ticker, coinId: coin.id };
    } catch (e) {}
    
    const viaOpts = optionalViaOptions || viaOptions;
    if (viaOpts) {
      const viaOpt = viaOpts.find(v => v.id === currencyId);
      if (viaOpt?.name && viaOpt.name !== currencyId) {
        return { name: viaOpt.name, ticker: viaOpt.name, coinId: null };
      }
    }
    
    const displayName = getCurrencyDisplayName(currencyId, null);
    if (displayName && displayName !== currencyId) {
      return { name: displayName, ticker: displayName, coinId: null };
    }
    
    const name = currencyId.length > 16 ? `${currencyId.substring(0, 8)}...${currencyId.slice(-6)}` : currencyId;
    return { name, ticker: name, coinId: null };
  }, [viaOptions]);

  const targetInfo = useMemo(() => {
    // Prefer display labels captured from conversion paths (never show vUSDC.vETH / i-addresses)
    if (targetDisplayName || targetDisplayTicker) {
      let coinId = null;
      try {
        const coin = CoinDirectory.findCoinObj(targetCurrency);
        if (coin) coinId = coin.id;
      } catch (e) {}
      
      return {
        name: targetDisplayName || targetDisplayTicker || 'Unknown',
        ticker: targetDisplayTicker || targetDisplayName || '?',
        coinId,
      };
    }
    
    return getCurrencyInfo(targetCurrency);
  }, [targetCurrency, getCurrencyInfo, targetDisplayName, targetDisplayTicker]);

  // Extract fee information from preflight result
  const feeInfo = useMemo(() => {
    if (!preflightResult) return null;

    // Helper to format fee amount - limit decimals for cleaner display
    const formatFeeAmount = (feeCoins) => {
      const bn = BigNumber(feeCoins);
      // For very small amounts (ETH fees), show up to 6 significant decimals
      // For larger amounts, use fewer decimals
      if (bn.isLessThan(0.0001)) {
        return bn.decimalPlaces(8).toString();
      } else if (bn.isLessThan(0.01)) {
        return bn.decimalPlaces(6).toString();
      } else {
        return bn.decimalPlaces(4).toString();
      }
    };

    // Simple send - fee is directly available
    if (preflightResult.fee) {
      const feeCurrency = preflightResult.feeCurr || sourceCoin?.display_ticker || 'VRSC';
      let feeCoinId = null;
      
      // Look up the fee currency's coin ID for accurate fiat conversion
      // This is especially important for ERC20 where fees are in ETH, not the token
      if (preflightResult.feeCurr) {
        try {
          const coin = CoinDirectory.findCoinObj(preflightResult.feeCurr);
          if (coin) {
            feeCoinId = coin.id;
          }
        } catch (e) {
          // Fee currency not found in directory, fallback to source coin
          feeCoinId = sourceCoin?.id || null;
        }
      } else {
        // No explicit fee currency, use source coin
        feeCoinId = sourceCoin?.id || null;
      }
      
      return {
        amount: formatFeeAmount(preflightResult.fee),
        currency: feeCurrency,
        coinId: feeCoinId,
      };
    }

    // Convert/cross-chain - fee might be in validation.fees
    if (preflightResult.validation?.fees) {
      const fees = preflightResult.validation.fees;
      
      for (const currencyId of Object.keys(fees)) {
        const feeSats = BigNumber(fees[currencyId]);
        if (feeSats.isGreaterThan(0)) {
          const feeCoins = satsToCoins(feeSats);
          // Try to get friendly name for fee currency
          let feeCurrName = currencyId;
          let feeCoinId = null;
          
          // Special handling for ETH contract address (null address represents native ETH)
          const ETH_NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
          if (currencyId.toLowerCase() === ETH_NULL_ADDRESS.toLowerCase()) {
            feeCurrName = 'ETH';
            feeCoinId = 'ETH';
          } else {
            try {
              const coin = CoinDirectory.findCoinObj(currencyId);
              if (coin) {
                feeCurrName = coin.display_ticker;
                feeCoinId = coin.id;
              }
            } catch (e) {
              // Not found by id, try looking up by currency_id for 0x addresses
              if (currencyId.startsWith('0x')) {
                try {
                  const allCoins = Object.values(CoinDirectory.coins || {});
                  const matchingCoin = allCoins.find(c => 
                    c.currency_id && c.currency_id.toLowerCase() === currencyId.toLowerCase()
                  );
                  if (matchingCoin) {
                    feeCurrName = matchingCoin.display_ticker;
                    feeCoinId = matchingCoin.id;
                  }
                } catch (e2) {
                  // Fall through to default
                }
              }
              if (!feeCoinId) {
                feeCurrName = getCurrencyDisplayName(currencyId, currencyId);
              }
            }
          }
          return { amount: formatFeeAmount(feeCoins), currency: feeCurrName, coinId: feeCoinId };
        }
      }
    }

    // Fallback - calculate from nativeFeesPaid if available
    if (preflightResult.nativeFeesPaid) {
      const feeCoins = satsToCoins(BigNumber(preflightResult.nativeFeesPaid));
      return { amount: formatFeeAmount(feeCoins), currency: sourceCoin?.display_ticker || 'VRSC', coinId: sourceCoin?.id || null };
    }

    // Default minimum fee for VRPC transactions
    if (channelType === VRPC) {
      return { amount: '0.0001', currency: sourceCoin?.display_ticker || 'VRSC', coinId: sourceCoin?.id || null };
    }

    return null;
  }, [preflightResult, sourceCoin, channelType]);

  // Calculate fiat value for the amount being sent
  const amountFiatDisplay = useMemo(() => {
    if (!amount || !sourceCoin?.id) return null;
    return formatFiat(amount, sourceCoin.id);
  }, [amount, sourceCoin, formatFiat]);

  // Calculate fiat value for the receiving amount
  const receiveFiatDisplay = useMemo(() => {
    if (!displayEstimate?.estimatedcurrencyout || !targetInfo?.coinId) return null;
    return formatFiat(displayEstimate.estimatedcurrencyout, targetInfo.coinId);
  }, [displayEstimate, targetInfo, formatFiat]);

  // Calculate fiat value for the network fee
  // For VRSC fees, show more precision to demonstrate how small they are
  const feeFiatDisplay = useMemo(() => {
    if (!feeInfo?.amount || !feeInfo?.coinId) return null;

    const formatFiatWithDecimals = (fiatValue, decimals) => {
      const [formatted, valueWithoutSymbol, symbol] = formatCurrency({
        amount: '0.00',
        code: displayCurrency,
      });

      const referenceValue = valueWithoutSymbol || '0.00';
      let prefix = '';
      let suffix = '';

      if (formatted && formatted.includes(referenceValue)) {
        const idx = formatted.indexOf(referenceValue);
        prefix = formatted.slice(0, idx);
        suffix = formatted.slice(idx + referenceValue.length);
      } else {
        prefix = symbol || displayCurrency;
      }

      const lastDot = referenceValue.lastIndexOf('.');
      const lastComma = referenceValue.lastIndexOf(',');
      const decimalSeparator = lastComma > lastDot ? ',' : '.';

      const rawValue = fiatValue
        .decimalPlaces(decimals, BigNumber.ROUND_HALF_UP)
        .toFixed(decimals);
      const localizedValue = decimalSeparator === '.'
        ? rawValue
        : rawValue.replace('.', decimalSeparator);

      return `${prefix}${localizedValue}${suffix}`;
    };

    // For VRSC fees, use higher precision to show the actual small value
    const isVrscFee = feeInfo.coinId === 'VRSC' || feeInfo.currency === 'VRSC';
    if (isVrscFee) {
      const rate = getRate(feeInfo.coinId);
      if (!rate) return null;
      try {
        const fiatValue = BigNumber(feeInfo.amount).multipliedBy(BigNumber(rate));
        if (fiatValue.isNaN() || !fiatValue.isFinite()) return null;

        if (fiatValue.isLessThan(0.01)) {
          return formatFiatWithDecimals(fiatValue, 4);
        }
        if (fiatValue.isLessThan(0.1)) {
          return formatFiatWithDecimals(fiatValue, 3);
        }
        return formatFiatWithDecimals(fiatValue, 2);
      } catch (e) {
        return null;
      }
    }

    return formatFiat(feeInfo.amount, feeInfo.coinId);
  }, [feeInfo, formatFiat, getRate, displayCurrency]);

  // Calculate conversion fee (taken from send amount for DeFi conversions)
  // Direct conversion: 0.025% (0.00025), Via conversion: 0.05% (0.0005)
  const conversionFeeInfo = useMemo(() => {
    if (!isConversion || !amount) return null;

    let multiplier = BigNumber(0);
    if (via) {
      // Conversion via an intermediate currency: 0.05%
      multiplier = BigNumber(0.0005);
    } else {
      // Direct conversion: 0.025%
      multiplier = BigNumber(0.00025);
    }

    const fee = BigNumber(amount).multipliedBy(multiplier);
    if (fee.isZero() || fee.isNaN()) return null;

    return {
      amount: fee.decimalPlaces(8).toString(),
      currency: sourceCoin?.display_ticker || '',
      percentage: via ? '0.05%' : '0.025%',
    };
  }, [isConversion, amount, via, sourceCoin]);

  // Get the sending address for display
  const sendingAddress = useMemo(() => {
    return getSendingAddress();
  }, [getSendingAddress]);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!preflightResult) return;

    setSending(true);

    try {
      let result;

      if (isSimpleSend) {
        result = await send(
          sourceCoin,
          activeAccount,
          recipientAddress,
          BigNumber(amount),
          channel,
          preflightResult
        );
      } else {
        result = await sendConvertOrCrossChain(
          sourceCoin,
          activeAccount,
          channel,
          preflightResult
        );
      }

      if (result.err) {
        throw new Error(result.result);
      }

      // Expire relevant data
      dispatch(expireCoinData(sourceCoin.id, API_GET_BALANCES));
      dispatch(expireCoinData(sourceCoin.id, API_GET_TRANSACTIONS));
      dispatch(expireCoinData(sourceCoin.id, API_GET_FIATPRICE));

      // Store result and navigate to success screen
      setTxResult(result.result);
      navigation.navigate('SendWizardSuccess');
    } catch (e) {
      console.error('Send error:', e);
      Alert.alert('Error', e.message || 'Transaction failed');
    }

    setSending(false);
  }, [
    preflightResult,
    isSimpleSend,
    sourceCoin,
    activeAccount,
    recipientAddress,
    amount,
    channel,
    dispatch,
    navigation,
    setTxResult,
  ]);

  // Truncate address
  const truncateAddress = (addr) => {
    if (!addr || addr.length <= 16) return addr;
    return `${addr.substring(0, 5)}...${addr.substring(addr.length - 5)}`;
  };

  if (!sourceCoin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#666' }}>No transaction data.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primaryColor} />
        <Text style={{ marginTop: 16, color: '#666' }}>Preparing transaction...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, { paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#E53935', textAlign: 'center' }}>
          Error
        </Text>
        <Text style={{ marginTop: 12, color: '#666', textAlign: 'center' }}>
          {error}
        </Text>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 24 }}
        >
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.mainTitle}>Confirm</Text>
          <Text style={styles.subtitle}>Review your transaction</Text>

          {/* Warnings */}
          {warnings.length > 0 && (
            <View style={styles.warningsContainer}>
              {warnings.map((w, i) => (
                <View key={i} style={styles.warningItem}>
                  <Text style={styles.warningText}>⚠️ {w.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Amount Section - Modern left-aligned display */}
          <View style={styles.amountSection}>
            {/* Sending */}
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>You're sending</Text>
              <View style={styles.amountRow}>
                {sourceCoin && RenderSquareCoinLogo(sourceCoin.id, { marginRight: 10 }, 28, 28)}
                <View style={styles.amountTextContainer}>
                  <View style={styles.amountValueRow}>
                    <Text style={styles.amountValue}>{amount}</Text>
                    <Text style={styles.amountTicker}>{sourceCoin.display_ticker}</Text>
                  </View>
                  {amountFiatDisplay && (
                    <Text style={styles.amountFiat}>{amountFiatDisplay}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Divider with arrow */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <View style={styles.arrowCircle}>
                <MaterialCommunityIcons name="arrow-down" size={16} color="#888" />
              </View>
              <View style={styles.dividerLine} />
            </View>

            {/* Receiving */}
            {isConversion && (
              <View style={styles.amountBlock}>
                <View style={styles.receiveLabelRow}>
                  <Text style={styles.amountLabel}>You'll receive</Text>
                  <TouchableOpacity
                    onPress={() => setConversionReceiveInfoVisible(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.estimateBadge}
                  >
                    <Text style={styles.estimateBadgeText}>Estimated</Text>
                    <MaterialCommunityIcons name="information-outline" size={11} color={Colors.primaryColor} />
                  </TouchableOpacity>
                </View>
                <View style={styles.amountRow}>
                  {targetInfo.coinId && RenderSquareCoinLogo(targetInfo.coinId, { marginRight: 10 }, 28, 28)}
                  {!targetInfo.coinId && (
                    <View style={styles.placeholderLogo}>
                      <Text style={styles.placeholderText}>{(targetInfo.ticker || '?').substring(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.amountTextContainer}>
                    <View style={styles.amountValueRow}>
                      <Text style={styles.amountValue}>
                        ~{displayEstimate?.estimatedcurrencyout
                          ? BigNumber(displayEstimate.estimatedcurrencyout).decimalPlaces(8).toString()
                          : '?'}
                      </Text>
                      <Text style={styles.amountTicker}>{targetInfo.ticker}</Text>
                    </View>
                    {receiveFiatDisplay && (
                      <Text style={styles.amountFiat}>~{receiveFiatDisplay}</Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Details Card */}
          <View style={styles.detailsCard}>
            {/* Recipient */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {recipientAddress.endsWith('@') ? recipientAddress : truncateAddress(recipientAddress)}
              </Text>
            </View>

            {/* Destination network (cross-chain) */}
            {(exportTo || isCrossChain) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Destination network</Text>
                <Text style={styles.detailValue}>
                  {getNetworkDisplayName(exportTo, exportToFqn || getCurrencyInfo(exportTo).name)}
                </Text>
              </View>
            )}

            {/* Route via */}
            {via && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Route via</Text>
                <Text style={styles.detailValue}>
                  {getCurrencyInfo(via).name}
                </Text>
              </View>
            )}

            {/* Estimated time until arrival */}
            {estimatedTime && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estimated time</Text>
                <View style={styles.detailValueWithInfo}>
                  <Text style={[styles.detailValue, { maxWidth: undefined }]}>
                    {estimatedTime}
                  </Text>
                  {(isBridgeTransaction || isPbaasConversion) && (
                    <TouchableOpacity
                      onPress={() => {
                        if (isBridgeTransaction) {
                          setEstimatedTimeInfoVisible(true);
                        } else if (isPbaasConversion) {
                          setPbaasTimeInfoVisible(true);
                        }
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.infoIconButton}
                    >
                      <MaterialCommunityIcons
                        name="timer-sand"
                        size={22}
                        color={Colors.primaryColor}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Network fee */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network fee</Text>
              <View style={styles.detailValueWithInfo}>
                <View style={styles.feeValueContainer}>
                  <Text style={[styles.detailValue, { maxWidth: undefined }]} numberOfLines={1}>
                    {feeInfo ? `${feeInfo.amount} ${feeInfo.currency}` : '~0.0001 VRSC'}
                  </Text>
                  {feeFiatDisplay && (
                    <Text style={styles.feeFiat}>{feeFiatDisplay}</Text>
                  )}
                </View>
                {isBridgeTransaction && (
                  <TouchableOpacity
                    onPress={() => setFeeInfoVisible(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.infoIconButton}
                  >
                    <MaterialCommunityIcons
                      name="gas-station-outline"
                      size={22}
                      color={Colors.primaryColor}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Conversion fee (only for conversions) */}
            {conversionFeeInfo && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Conversion fee</Text>
                <View style={styles.feeValueContainer}>
                  <Text style={[styles.detailValue, { maxWidth: undefined }]} numberOfLines={1}>
                    {conversionFeeInfo.amount} {conversionFeeInfo.currency}
                  </Text>
                  <Text style={styles.feeFiat}>({conversionFeeInfo.percentage}, included in amount)</Text>
                </View>
              </View>
            )}

            {/* From */}
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>From</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {sendingAddress ? truncateAddress(sendingAddress) : (sourceSubWallet?.name || 'My wallet')}
              </Text>
            </View>
          </View>

          {/* Balance info */}
          <Text style={styles.balanceNote}>
            Balance after: {BigNumber(sourceBalance || 0).minus(BigNumber(amount || 0)).decimalPlaces(4).toString()} {sourceCoin.display_ticker}
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.buttonContainer}>
        <GradientButton
          onPress={handleSend}
          disabled={sending || !preflightResult}
        >
          {sending ? 'Sending...' : 'Confirm & send'}
        </GradientButton>
      </View>

            {/* Bridge transaction info sheets */}
            <Portal>
              <BridgeEstimatedTimeInfoSheet
                visible={estimatedTimeInfoVisible}
                onClose={() => setEstimatedTimeInfoVisible(false)}
                isToEthereum={channelType === VRPC}
              />
              <BridgeFeeInfoSheet
                visible={feeInfoVisible}
                onClose={() => setFeeInfoVisible(false)}
                isToEthereum={channelType === VRPC}
              />
              <ConversionReceiveInfoSheet
                visible={conversionReceiveInfoVisible}
                onClose={() => setConversionReceiveInfoVisible(false)}
              />
              <PbaasEstimatedTimeInfoSheet
                visible={pbaasTimeInfoVisible}
                onClose={() => setPbaasTimeInfoVisible(false)}
              />
            </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  headerCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 6,
  },
  headerCloseButtonDisabled: {
    opacity: 0.4,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 4,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  warningsContainer: {
    marginBottom: 16,
  },
  warningItem: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
  },
  // Amount section - modern left-aligned display
  amountSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  amountBlock: {
    paddingVertical: 4,
  },
  amountLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountTextContainer: {
    flex: 1,
  },
  amountValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  amountTicker: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  amountFiat: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  // Divider with arrow
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  // Receive label row with badge
  receiveLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  estimateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  estimateBadgeText: {
    fontSize: 10,
    color: Colors.primaryColor,
    fontWeight: '600',
    marginRight: 3,
  },
  placeholderLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  placeholderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
  },
  // Details card
  detailsCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    color: '#888',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailValueWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  feeValueContainer: {
    alignItems: 'flex-end',
  },
  feeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconButton: {
    marginLeft: 6,
    padding: 2,
  },
  feeFiat: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    textAlign: 'right',
  },
  fromValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  balanceNote: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 28,
    backgroundColor: 'white',
  },
});

export default SendWizardConfirm;
