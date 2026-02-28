import { Tools } from 'react-native-verus'; 
import ApiException from '../../../errors/apiError';
import { DLIGHT_PRIVATE } from '../../../../constants/intervalConstants';


export const decryptData = async (alias, params) => {
  try {
    const plaintext = await Tools.decryptData({
      ivkHex: params.ivkHex || null,
      ephemeralPublicKeyHex: params.ephemeralPublicKeyHex || null,
      ciphertextHex: params.ciphertextHex,
      symmetricKeyHex: params.symmetricKeyHex || null
    });

    return {
      result: plaintext,
      err: false
    };
  } catch (e) {
    return {
      err: true,
      result: new ApiException(e.message, e.data, alias, DLIGHT_PRIVATE, e.code)
    };
  }
}