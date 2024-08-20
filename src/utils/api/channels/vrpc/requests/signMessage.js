import { requestPrivKey } from "../../../../auth/authBox"
import { VRPC } from "../../../../constants/intervalConstants"
import VrpcProvider from "../../../../vrpc/vrpcInterface"

export const signMessage = async (coinObj, iAddrOrIdentity, message) => {
  const privKey = await requestPrivKey(coinObj.id, VRPC)

  return VrpcProvider.getVerusIdInterface(coinObj.system_id).signMessage(
    iAddrOrIdentity,
    message,
    privKey,
  );
}

export const getSignatureInfo = async (coinObj, iAddrOrIdentity, signature) => {


  return VrpcProvider.getVerusIdInterface(coinObj.system_id).getSignatureInfo(
    iAddrOrIdentity,
    signature
  );
}