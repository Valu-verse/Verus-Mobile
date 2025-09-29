import { SET_DEEPLINK_DATA, SET_DEEPLINK_URL, SET_DEEPLINK_CANCEL } from "../../../../utils/constants/storeType"

export const setDeeplinkUrl = (url) => {
  return {
    type: SET_DEEPLINK_URL,
    payload: { url }
  }
}

export const setDeeplinkData = (id, data) => {
  return {
    type: SET_DEEPLINK_DATA,
    payload: { id, data }
  }
}

export const setDeeplinkCancel = (cancel) => {
  return {
    type: SET_DEEPLINK_CANCEL,
    payload: { cancel }
  }
}

export const resetDeeplinkData = () => {
  return {
    type: SET_DEEPLINK_DATA,
    payload: { id: null, data: {}, fromService: null, passthrough: null, cancel: null}
  }
}