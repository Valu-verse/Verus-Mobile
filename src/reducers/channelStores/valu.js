/*
  The coin reducer contains general channel specific information
*/

import { off } from 'process'
import {
    INIT_VALU_COIN_CHANNEL_FINISH,
    CLOSE_VALU_COIN_CHANNEL,
    SIGN_OUT_COMPLETE,
    OPEN_VALU_SERVICE_CHANNEL,
    CLOSE_VALU_SERVICE_CHANNEL,
    AUTHENTICATE_VALU_SERVICE,
    DEAUTHENTICATE_VALU_SERVICE,
    SET_VALU_ACCOUNT_ID,
    SET_CURRENT_VALU_ACCOUNT_DATA,
    SET_VALU_ACCOUNT_STAGE,
    SET_VALU_AMOUNT_FUNDED,
    OPEN_OFFRAMP,
    RESET_OFFRAMP,
    INITIATE_OFFRAMP_REQUEST,
    COMPLETE_OFFRAMP_REQUEST,
    SET_OFFRAMP_STATUS,
    INITIATE_VALU_PARTNER_USER_ID
  } from '../../utils/constants/storeType'

  export const channelStore_valu_service = (state = {
    openCoinChannels: {},
    serviceChannelOpen: true,
    authenticated: false,
    accountId: null,
    accountLogin: null,
    currentAccountDataScreenParams: null,
    amountFunded: 0,
    onrampRequests: {},
    offRampRequest: {},
    openOffRamp: false,
  }, action) => {
    switch (action.type) {
      case INIT_VALU_COIN_CHANNEL_FINISH:
        return {
          ...state,
          openCoinChannels: {
            ...state.openCoinChannels,
            [action.payload.chainTicker]: true
          },
        }
      case CLOSE_VALU_COIN_CHANNEL:
        return {
          ...state,
          openCoinChannels: {
            ...state.openCoinChannels,
            [action.payload.chainTicker]: false
          },
        }
      case OPEN_VALU_SERVICE_CHANNEL:
        return {
          ...state,
          serviceChannelOpen: true
        }
      case CLOSE_VALU_SERVICE_CHANNEL:
        return {
          ...state,
          serviceChannelOpen: false
        }
      case AUTHENTICATE_VALU_SERVICE:
        return {
          ...state,
          authenticated: true,
          accountId: action.payload.accountId
        }
      case DEAUTHENTICATE_VALU_SERVICE:
        return {
          ...state,
          authenticated: false,
          accountId: null
        }
      case SET_VALU_ACCOUNT_ID:
        return {
          ...state,
          accountId: action.payload.accountId,
          KYCState: action.payload.KYCState
        }
      case SET_VALU_ACCOUNT_STAGE:
        return {
          ...state,
          KYCState: action.payload.KYCState
        }
      case SIGN_OUT_COMPLETE:
        return {
          openCoinChannels: {},
          serviceChannelOpen: true,
          authenticated: false,
          accountId: null,
          accountLogin: null,
          currentAccountDataScreenParams: null,
          amountFunded: 0,
          onrampRequests: {},
          offRampRequest: {},
          openOffRamp: false,
          // Reset any other state variables that may have been added
          KYCState: undefined,
          partnerUserId: undefined
        }
      case SET_CURRENT_VALU_ACCOUNT_DATA:
        return {
          ...state,
          currentAccountDataScreenParams: action.payload.accountData
        }
      case SET_VALU_AMOUNT_FUNDED:
        return {
          ...state,
          amountFunded: action.payload.amountFunded
        }
      case INITIATE_VALU_PARTNER_USER_ID:
        return {
          ...state,
          partnerUserId: action.payload.partnerUserId
        }
      case INITIATE_OFFRAMP_REQUEST:
        return {
          ...state,
          offRampRequest: action.payload.details
        }
      case COMPLETE_OFFRAMP_REQUEST:
        return {
          ...state,
          offRampRequest: {}
        }
      case SET_OFFRAMP_STATUS:
        return {
          ...state,
          offRampRequest: {
            ...state.offRampRequest,
            status: action.payload.status
          }
        }
      case OPEN_OFFRAMP:
        return {
          ...state,
          openOffRamp: true
        }
      case RESET_OFFRAMP:
        return {
          ...state,
          openOffRamp: false
        }  
      default:
        return state;
    }
  }