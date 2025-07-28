var RNFS = require('react-native-fs');
import { ATTESTATION_DATA_STORAGE_INTERNAL_KEY } from '../../../env/index'

export const storeAttestationData = (data) => {
  if (typeof data !== 'object') throw new Error(`Attestation data store function expected object, received ${typeof data}`)

  return new Promise((resolve, reject) => {
    try {
      const jsonString = JSON.stringify(data);
      RNFS.writeFile(RNFS.DocumentDirectoryPath + `/${ATTESTATION_DATA_STORAGE_INTERNAL_KEY}.txt`, jsonString, 'utf8')
        .then((success) => {
          resolve(data);
        })
        .catch(err => {
          reject(err)
        })
    } catch (stringifyError) {
      reject(new Error(`Failed to stringify attestation data: ${stringifyError.message}`))
    }
  })
};

export const loadAttestationData = () => {
  return new Promise((resolve, reject) => {
    RNFS.readFile(RNFS.DocumentDirectoryPath + `/${ATTESTATION_DATA_STORAGE_INTERNAL_KEY}.txt`, "utf8")
      .then(res => {
        if (!res) {
          resolve({});
        } else {
          try {
            const _res = JSON.parse(res);
            resolve(_res);
          } catch (parseError) {
            console.error('Failed to parse attestation data JSON:', parseError.message);
            console.error('Corrupted data:', res.substring(0, 500) + '...');
            reject(new Error(`Failed to parse attestation data: ${parseError.message}`));
          }
        }
      })
      .catch(err => {
        if (err.code === 'ENOENT') {
          resolve({});
        } else {
          reject(err);
        }
      });
  })
};

export const clearAllAttestationData = () => {
  return new Promise((resolve, reject) => {
    RNFS.unlink(RNFS.DocumentDirectoryPath + `/${ATTESTATION_DATA_STORAGE_INTERNAL_KEY}.txt`)
      .then(() => {
        resolve();
      })
      .catch(err => reject(err));
  })
};

export const storeAttestationDataForUser = async (data, accountHash) => {
  let allAttestationData = { ...(await loadAttestationData()) }
  allAttestationData[accountHash] = data
  return (await storeAttestationData(allAttestationData))[accountHash]
}

export const deleteAttestationDataForUser = async (accountHash) => {
  let allAttestationData = { ...(await loadAttestationData()) }
  delete allAttestationData[accountHash]
  return (await storeAttestationData(allAttestationData))[accountHash]
}

export const loadAttestationDataForUser = async (accountHash) => {
  try {
    const allAttestationData = await loadAttestationData()

    if (allAttestationData[accountHash] == null)
      return {
        attestations_provisioned: null
      };
    else return allAttestationData[accountHash];
  } catch (error) {
    console.error('Failed to load attestation data for user, returning default:', error.message);
    return {
      attestations_provisioned: null
    };
  }
};

export const clearCorruptedAttestationDataForUser = async (accountHash) => {
  try {
    let allAttestationData = { ...(await loadAttestationData()) }
    delete allAttestationData[accountHash]
    await storeAttestationData(allAttestationData)
    console.log(`Cleared corrupted attestation data for user: ${accountHash}`);
    return true;
  } catch (error) {
    console.error('Failed to clear corrupted attestation data:', error.message);
    return false;
  }
};
