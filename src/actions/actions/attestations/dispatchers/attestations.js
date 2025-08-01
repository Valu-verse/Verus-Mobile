import store from "../../../../store"
import { deleteAttestationDataForUser, loadAttestationDataForUser, storeAttestationDataForUser, clearCorruptedAttestationDataForUser } from "../../../../utils/nativeStore/attestationDataStorage"
import { requestPassword } from "../../../../utils/auth/authBox"
import { encryptkey, decryptkey } from "../../../../utils/seedCrypt"
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
    if (!accountHash) {
      throw new Error('Account hash is required');
    }
    
    if (!dataType) {
      throw new Error('Data type is required');
    }
    
    let attestationData = {...(await loadAttestationDataForUser(accountHash))}
    
    // Validate data before stringifying
    if (data === null || data === undefined) {
      throw new Error('Data cannot be null or undefined');
    }
    
    // Get password once and reuse it
    const password = await requestPassword();
    
    // Get existing data for this dataType and merge with new data
    let existingTypeData = {};
    if (attestationData[dataType]) {
      try {
        const decryptedExisting = decryptkey(password, attestationData[dataType]);
        if (decryptedExisting !== false) {
          existingTypeData = JSON.parse(decryptedExisting);
        }
      } catch (decryptError) {
        console.warn(`Failed to decrypt/parse existing ${dataType} data, starting fresh:`, decryptError.message);
        existingTypeData = {};
      }
    }
    
    // Merge new data with existing data (new data takes precedence for duplicate keys)
    const mergedData = { ...existingTypeData, ...data };
    
    const jsonString = JSON.stringify(mergedData);
    if (!jsonString || jsonString === 'undefined' || jsonString === 'null') {
      throw new Error('Failed to stringify attestation data or resulted in invalid JSON');
    }
    
    // Verify we can parse it back
    try {
      JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error(`Data produces invalid JSON: ${parseError.message}`);
    }
    
    attestationData[dataType] = await encryptkey(password, jsonString)
    await saveEncryptedAttestationDataForUser(attestationData, accountHash)

    return mergedData
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