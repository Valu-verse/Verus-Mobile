import Store from '../../../../../store/index'
import {
  INIT_VALU_COIN_CHANNEL_START,
  CLOSE_VALU_COIN_CHANNEL,
  INITIATE_ONRAMP_REQUEST,
  COMPLETE_ONRAMP_REQUEST,
  SET_ONRAMP_STATUS,
  INITIATE_OFFRAMP_REQUEST,
  COMPLETE_OFFRAMP_REQUEST,
  RESET_OFFRAMP,
  OPEN_OFFRAMP,
  INITIATE_VALU_PARTNER_USER_ID,
  CHECK_FOR_ACTIVE_OFFRAMP_PROCESS,
  SET_SPONSORED_ATTESTATION_STATE,
  UPDATE_SPONSORED_ATTESTATION_IDENTITY,
  COMPLETE_SPONSORED_ATTESTATION,
  RESET_SPONSORED_ATTESTATION
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

export const initiatePartnerUserId = async (seed) => {
  const bearer = await ValuProvider.bearerFromSeed(seed);
  Store.dispatch({
  type: INITIATE_VALU_PARTNER_USER_ID,
    payload: { partnerUserId: bearer }
  })
  return bearer
}

export const initiateOnrampRequest = (requestId, details) => {
  Store.dispatch({
    type: INITIATE_ONRAMP_REQUEST,
    payload: { requestId, details }
  })
  return
}

export const completeOnrampRequest = (requestId) => {
  Store.dispatch({
    type: COMPLETE_ONRAMP_REQUEST,
    payload: { requestId }
  })
  return
}

export const checkOnrampStatus = (requestId, status) => {
  Store.dispatch({
    type: SET_ONRAMP_STATUS,
    payload: { requestId, status }
  })
  return
}

export const initiateOfframpRequest = (details) => {
  Store.dispatch({
    type: INITIATE_OFFRAMP_REQUEST,
    payload: { details }
  })
  return
}

export const completeOfframpRequest = () => {
  Store.dispatch({
    type: COMPLETE_OFFRAMP_REQUEST,
    payload: { }
  })
  return
}


export const checkForActiveOffRampProcess = (params) => {
  Store.dispatch({
    type: CHECK_FOR_ACTIVE_OFFRAMP_PROCESS,
    payload: { params }
  })
  return
}

export const setSponsoredAttestationState = (stateUpdate) => {
  Store.dispatch({
    type: SET_SPONSORED_ATTESTATION_STATE,
    payload: stateUpdate
  })
  return
}

export const updateSponsoredAttestationIdentity = (identityName, identityAddress, isExisting = false, isPending = false) => {
  Store.dispatch({
    type: UPDATE_SPONSORED_ATTESTATION_IDENTITY,
    payload: { identityName, identityAddress, isExisting, isPending }
  })
  return
}

export const completeSponsoredAttestation = () => {
  Store.dispatch({
    type: COMPLETE_SPONSORED_ATTESTATION,
    payload: {}
  })
  return
}

export const resetSponsoredAttestation = () => {
  Store.dispatch({
    type: RESET_SPONSORED_ATTESTATION,
    payload: {}
  })
  return
}

export const openOffRamp = () => {
  Store.dispatch({
    type: OPEN_OFFRAMP,
    payload: {}
  })
  return
}

export const closeOffRamp = () => {
  Store.dispatch({
    type: RESET_OFFRAMP,
    payload: {}
  })
  return
}