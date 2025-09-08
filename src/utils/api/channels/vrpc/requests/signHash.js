import { requestPrivKey } from "../../../../auth/authBox"
import { VRPC } from "../../../../constants/intervalConstants"
import VrpcProvider from "../../../../vrpc/vrpcInterface"

export const signHash = async (coinObj, iAddrOrIdentity, message, height) => {
  const privKey = await requestPrivKey(coinObj.id, VRPC)

  return VrpcProvider.getVerusIdInterface(coinObj.system_id).signHash(
    iAddrOrIdentity,
    message,
    privKey,
    null,
    height
  );
}
