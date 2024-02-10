import { primitives } from "verusid-ts-client"
import { verifyIdProvisioningResponse } from "./verifyIdProvisioningResponse";
import { NOTIFICATION_TYPE_VERUSID_PENDING } from '../../../../constants/services';
import { updatePendingVerusIds } from "../../../../../actions/actions/channels/verusid/dispatchers/VerusidWalletReduxManager"
import { setRequestedVerusId } from '../../../../../actions/actions/services/dispatchers/verusid/verusid';
import { getIdentity } from "../../verusid/callCreators";

export const handleProvisioningResponse = async (
  coinObj,
  responseJson,
  loginRequestBase64,
  fromService,
  provisioningName,
  notificationUid,
  setNotification = (fqn, accountHash) => { }
) => {

  // Verify response signature
  const verified = await verifyIdProvisioningResponse(coinObj, responseJson);

  if (!verified) throw new Error('Failed to verify response from service');

  const response = new primitives.LoginConsentProvisioningResponse(responseJson);

  const {decision} = response;
  const {result} = decision;
  const {
    error_desc,
    state,
  } = result;

  if (state === primitives.LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid) {
    throw new Error(error_desc);
  } else if (state === primitives.LOGIN_CONSENT_PROVISIONING_RESULT_STATE_PENDINGAPPROVAL.vdxfid ||
    state === primitives.LOGIN_CONSENT_PROVISIONING_RESULT_STATE_COMPLETE.vdxfid) { 

    // If the response is pending approval, store the pending verus id and it will be
    // checked on an interval until it is approved or rejected
    // If the response is complete, the transaction still has to be awaited so exit out of verusid login.
    const verusIdState = {
      status: NOTIFICATION_TYPE_VERUSID_PENDING,
      fqn: result.fully_qualified_name,
      loginRequest: loginRequestBase64,
      fromService: fromService,
      createdAt: Number((Date.now() / 1000).toFixed(0)),
      infoUri: result.info_uri,
      provisioningName: provisioningName,
      notificationUid: notificationUid
    }
    await setRequestedVerusId(result.identity_address, verusIdState, coinObj.id);
    await updatePendingVerusIds();
    await setNotification(result.fully_qualified_name);

  } else {
    throw new Error('Unsupported provisioning response state');
  }
};