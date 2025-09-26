import { SET_DEEPLINK_PASSTHROUGH_DATA } from "../../../../utils/constants/storeType"
import { PERMISSION_STATUS } from "../../../../utils/constants/loginPermissions"

export const setDeeplinkPassthroughData = (passthrough) => {
  return {
    type: SET_DEEPLINK_PASSTHROUGH_DATA,
    payload: { passthrough }
  }
}

// Generic function to set permission status by index
export const setPermissionAgreed = (currentPassthrough, index, permissionType, additionalData = {}) => {
  const existingPermissions = currentPassthrough?.permissions || {};
  
  const updatedPermissions = {
    ...existingPermissions,
    [index]: {
      permissionType,
      status: PERMISSION_STATUS.AGREED,
      timestamp: Date.now(),
      ...additionalData
    }
  };

  const updatedPassthrough = {
    ...currentPassthrough,
    permissions: updatedPermissions
  };
  
  return setDeeplinkPassthroughData(updatedPassthrough);
}

export const setPermissionRejected = (currentPassthrough, index, permissionType, additionalData = {}) => {
  const existingPermissions = currentPassthrough?.permissions || {};
  
  const updatedPermissions = {
    ...existingPermissions,
    [index]: {
      permissionType,
      status: PERMISSION_STATUS.REJECTED,
      timestamp: Date.now(),
      ...additionalData
    }
  };

  const updatedPassthrough = {
    ...currentPassthrough,
    permissions: updatedPermissions
  };
  
  return setDeeplinkPassthroughData(updatedPassthrough);
};