/**
 * derivedPbaasRate.js
 * Derives fiat prices for PBaaS currencies that lack external price feeds
 * (e.g., CoinPaprika) by reading the on-chain bestcurrencystate from VRPC.
 *
 * For fractional/basket currencies with VRSC as a reserve, the currency
 * definition contains bestcurrencystate.currencies[reserveId].lastconversionprice
 * which represents "reserve per 1 unit of this currency." We multiply that by
 * the VRSC fiat rate (already fetched via CoinPaprika) to derive a fiat price.
 *
 * Created 2026-02-08
 */

import BigNumber from 'bignumber.js';
import VrpcProvider from '../../../../vrpc/vrpcInterface';
import store from '../../../../../store';
import { GENERAL } from '../../../../constants/intervalConstants';
import { USD } from '../../../../constants/currencies';

// Well-known system currency i-addresses and their store keys for rate lookups
const SYSTEM_CURRENCY_MAP = {
  'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV': 'VRSC',       // VRSC mainnet
  'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq': 'VRSCTEST',   // VRSC testnet
};

/**
 * Attempt to derive a fiat rate for a PBaaS currency from its on-chain
 * bestcurrencystate and a known anchor rate (e.g., VRSC).
 *
 * @param {Object} coinObj - The coin object from CoinDirectory
 * @returns {Promise<{result: Object, source: string} | null>}
 *   Returns { result: { USD: string, EUR: string, ... }, source } or null
 *   if the rate cannot be derived.
 */
export const getDerivedPbaasRate = async (coinObj) => {
  try {
    const systemId = coinObj.system_id;
    if (!systemId) return null;

    // Fetch the live currency definition (includes bestcurrencystate)
    const endpoint = VrpcProvider.getEndpoint(systemId);
    const currencyRes = await endpoint.getCurrency(coinObj.currency_id);

    if (currencyRes.error || !currencyRes.result) return null;

    const currencyDef = currencyRes.result;
    const bestState = currencyDef.bestcurrencystate;

    if (!bestState || !bestState.currencies) return null;

    // Iterate over reserves to find one with a known fiat rate in the store
    const state = store.getState();
    const generalRates = state.ledger?.rates?.[GENERAL];
    if (!generalRates) return null;

    const reserveIds = Object.keys(bestState.currencies);

    for (const reserveId of reserveIds) {
      const reserveState = bestState.currencies[reserveId];

      if (
        !reserveState ||
        reserveState.lastconversionprice == null
      ) {
        continue;
      }

      const lastConversionPrice = Number(reserveState.lastconversionprice);
      if (
        !lastConversionPrice ||
        lastConversionPrice <= 0 ||
        !isFinite(lastConversionPrice)
      ) {
        continue;
      }

      // Find the store key for this reserve (e.g., i-address → 'VRSC')
      const storeKey = SYSTEM_CURRENCY_MAP[reserveId] || null;
      if (!storeKey) continue;

      const anchorRates = generalRates[storeKey];
      if (!anchorRates || anchorRates[USD] == null) continue;

      // Derive fiat rates:
      // lastconversionprice = "reserve per 1 unit of this currency"
      // coinFiat = lastconversionprice * reserveFiat
      const result = {};
      for (const [fiatCurrency, reserveFiatRate] of Object.entries(anchorRates)) {
        const rate = Number(reserveFiatRate);
        if (rate && rate > 0 && isFinite(rate)) {
          result[fiatCurrency] = BigNumber(lastConversionPrice)
            .multipliedBy(rate)
            .toString();
        }
      }

      if (Object.keys(result).length === 0) continue;

      return {
        result,
        source: `derived:${coinObj.currency_id}:reserve=${reserveId}:lastconversionprice=${lastConversionPrice}`,
      };
    }

    return null;
  } catch (e) {
    console.warn(
      `Failed to derive PBaaS rate for ${coinObj.id}:`,
      e.message,
    );
    return null;
  }
};
