/**
 * general/updates.js
 * Updated 2026-02-08: Added fallback to derived PBaaS pricing when CoinPaprika
 * fails for PBaaS currencies. Uses on-chain bestcurrencystate to derive fiat
 * from a known reserve (e.g., VRSC) and its existing fiat rate.
 */

import { getCoinRates } from "../../../../../utils/api/channels/general/callCreators";
import { getDerivedPbaasRate } from "../../../../../utils/api/channels/general/ratesAPIs/derivedPbaasRate";
import { GENERAL, IS_PBAAS } from "../../../../../utils/constants/intervalConstants";

export const updateGeneralFiatPrices = async (coinObj) => {
  try {
    const coinRates = await getCoinRates(coinObj);
    const { result, ...header } = coinRates;

    return {
      chainTicker: coinObj.id,
      channel: GENERAL,
      header,
      body: result,
    };
  } catch (e) {
    // If CoinPaprika fails and this is a PBaaS currency, try deriving from
    // on-chain currency state (bestcurrencystate.lastconversionprice)
    const isPbaas =
      (coinObj.tags && coinObj.tags.includes(IS_PBAAS)) ||
      coinObj.pbaas_options != null;

    if (isPbaas) {
      const derived = await getDerivedPbaasRate(coinObj);

      if (derived) {
        return {
          chainTicker: coinObj.id,
          channel: GENERAL,
          header: { source: derived.source },
          body: derived.result,
        };
      }
    }

    // Re-throw the original error if derivation was not applicable or failed
    throw e;
  }
}