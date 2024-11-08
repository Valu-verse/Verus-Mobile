import Store from '../../../../../store/index'
import {
  INIT_VALU_COIN_CHANNEL_START,
  CLOSE_VALU_COIN_CHANNEL,
} from "../../../../../utils/constants/storeType";
import ValuProvider from '../../../../../utils/services/ValuProvider';

export const initValuCoinChannel = async (coinObj) => {

  // TODO: possible implement clear up of Valu notifications like verusid if needed
  await ValuProvider.loadValuCoinAddresses()

  Store.dispatch({
    type: INIT_VALU_COIN_CHANNEL_START,
    payload: { chainTicker: coinObj.id }
  })

  return
}

export const closeValuCoinWallet = async (coinObj) => {
  Store.dispatch({
    type: CLOSE_VALU_COIN_CHANNEL,
    payload: { chainTicker: coinObj.id }
  })

  return
}