import {
  CLOSE_VERUSID_CHANNEL,
  SIGN_OUT_COMPLETE,
  SET_WATCHED_VERUSIDS,
  INIT_VERUSID_CHANNEL_FINISH,
  SET_VERUSID_NOTIFICATIONS
} from '../../utils/constants/storeType'

export const channelStore_verusid = (state = {
  openCoinChannels: {},
  watchedVerusIds: {},
  pendingIds: {},
  serviceChannelOpen: true,
}, action) => {
  switch (action.type) {
    case INIT_VERUSID_CHANNEL_FINISH:
      return {
        ...state,
        openCoinChannels: {
          ...state.openCoinChannels,
          [action.payload.chainTicker]: true
        },
      }
    case CLOSE_VERUSID_CHANNEL:
      return {
        ...state,
        openCoinChannels: {
          ...state.openCoinChannels,
          [action.payload.chainTicker]: false
        },
      }
    case SIGN_OUT_COMPLETE:
      return {
        openCoinChannels: {},
        watchedVerusIds: {},
        pendingIds: {}
      }
    case SET_WATCHED_VERUSIDS:
      return {
        ...state,
        watchedVerusIds: action.payload.watchedVerusIds
      }
    case SET_VERUSID_NOTIFICATIONS:
      return {
        ...state,
        pendingIds: action.payload.pendingIds
      }
    default:
      return state;
  }
}