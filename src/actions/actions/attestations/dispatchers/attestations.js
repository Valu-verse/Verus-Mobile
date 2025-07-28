import store from "../../../../store"
import { deleteAttestationDataForUser, loadAttestationDataForUser, storeAttestationDataForUser, clearCorruptedAttestationDataForUser } from "../../../../utils/nativeStore/attestationDataStorage"
import { requestPassword } from "../../../../utils/auth/authBox"
import { encryptkey } from "../../../../utils/seedCrypt"
import { setAttestationData } from "../creators/attestations"

export const saveEncryptedAttestationDataForUser = async (encryptedData = {}, accountHash) => {  
  const attestationData = await storeAttestationDataForUser(encryptedData, accountHash)
  store.dispatch(setAttestationData(encryptedData))
  return attestationData
}

export const clearEncryptedAttestationDataForUser = async (accountHash) => {  
  const attestationData = await deleteAttestationDataForUser(accountHash)
  store.dispatch(setAttestationData({}))
  return attestationData
}

export const modifyAttestationDataForUser = async (data = {}, dataType, accountHash) => {
  try {
    let attestationData = {...(await loadAttestationDataForUser(accountHash))}
    
    // Validate data before stringifying
    const jsonString = JSON.stringify(data);
    if (!jsonString) {
      throw new Error('Failed to stringify attestation data');
    }
    
    attestationData[dataType] = await encryptkey(await requestPassword(), jsonString)
    await saveEncryptedAttestationDataForUser(attestationData, accountHash)

    return data
  } catch (error) {
    console.error('Error in modifyAttestationDataForUser:', error.message);
    throw new Error(`Failed to modify attestation data: ${error.message}`);
  }
}

export const initAttestationDataForUser = async (accountHash) => {
  try {
    const attestationData = await loadAttestationDataForUser(accountHash)
    store.dispatch(setAttestationData(attestationData))
    return attestationData
  } catch (error) {
    console.error('Failed to initialize attestation data, attempting to clear corrupted data:', error.message);
    const cleared = await clearCorruptedAttestationDataForUser(accountHash);
    if (cleared) {
      const defaultData = { attestations_provisioned: null };
      store.dispatch(setAttestationData(defaultData))
      return defaultData;
    } else {
      throw error;
    }
  }
}

export const clearCorruptedAttestationData = async (accountHash) => {
  const result = await clearCorruptedAttestationDataForUser(accountHash);
  if (result) {
    store.dispatch(setAttestationData({}));
  }
  return result;
}