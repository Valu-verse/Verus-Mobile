import { parseStoredAttestationHex } from '../../attestations/serializedAttestation';
import {
  UserDataRequestOrdinalVDXFObject,
  UserDataRequestDetails,
  AuthenticationRequestOrdinalVDXFObject,
  GenericRequest,
  GenericResponse,
} from "verus-typescript-primitives";
import VrpcProvider from '../../vrpc/vrpcInterface';
import { getBlock } from "../../api/channels/vrpc/requests/getBlock";
import { getSignatureInfo } from "../../api/channels/vrpc/requests/getSignatureInfo";
import { getIdentity } from "../../api/channels/verusid/callCreators";
import { getInfo } from "../../api/channels/vrpc/callCreators";
import { CoinDirectory } from "../../CoinData/CoinDirectory";
import { getSystemNameFromSystemId } from "../../CoinData/CoinData";
import { convertFqnToDisplayFormat } from "../../fullyqualifiedname";
import { requestAttestationData } from "../../auth/authBox";
import { ATTESTATIONS_PROVISIONED } from "../../constants/attestations";
import { BN } from "bn.js";
import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";

/**
 * Extract label and message from a DataDescriptor, handling both nested and
 * flat serialization formats.
 *   Nested: toJson().objectdata[DataDescriptorKey] → { label, objectdata: { message } }
 *   Flat:   toJson() → { label, objectdata: { message } }
 */
const getDescriptorLabelAndMessage = (descriptor) => {
  const json = descriptor.toJson();
  const descriptorKeyId = VDXF_Data.DataDescriptorKey?.vdxfid;
  const nested = json?.objectdata?.[descriptorKeyId];
  if (nested?.label) {
    return { label: nested.label, message: nested?.objectdata?.message };
  }
  return { label: json?.label || null, message: json?.objectdata?.message || null };
};

/**
 * Finds attestations matching the searchDataKey criteria from the stored attestation data.
 *
 * @param {Array<{[key:string]:string}>} searchDataKey
 * @param {string|null} signerIAddress - optional signer i-address filter
 * @param {boolean} isCollection
 * @param {object} attestationData - decrypted attestation store keyed by MMR hash
 * @returns {Array<{id: string, name: string, raw: object, attestationDetails: any, matchingDescriptors: any[]}>}
 */
const findMatchingAttestations = (searchDataKey, signerIAddress, isCollection, attestationData) => {
  const matches = [];
  const attestationDataKeys = Object.keys(attestationData);
  const attestationDataValues = Object.values(attestationData);

  if (!searchDataKey || searchDataKey.length === 0) return matches;

  for (let i = 0; i < attestationDataKeys.length; i++) {
    const attestationId = attestationDataKeys[i];
    const att = attestationDataValues[i];
    try {
      const { mmrDescriptor, signatureData } = parseStoredAttestationHex(att.data);
      if (!mmrDescriptor) continue;

      // Filter by signer if specified (IdentityID is an i-address string after fromBuffer)
      if (signerIAddress && signatureData.IdentityID !== signerIAddress) continue;

      let matchFound = false;
      let matchingDescriptors = [];

      if (isCollection) {
        // COLLECTION: match ANY of the searchDataKey entries
        for (const searchEntry of searchDataKey) {
          const sdkKey = Object.keys(searchEntry)[0];
          const sdkValue = searchEntry[sdkKey];

          for (const dataDescriptor of mmrDescriptor.dataDescriptors) {
            const { label, message } = getDescriptorLabelAndMessage(dataDescriptor);
            const keyMatches = label === sdkKey;
            const valueMatches = sdkValue === "" || message === sdkValue;

            if (keyMatches && valueMatches) {
              matchFound = true;
              matchingDescriptors.push(dataDescriptor);
              break;
            }
          }
        }
      } else {
        // FULL_DATA / PARTIAL_DATA: match the first searchDataKey entry
        const sdkKey = Object.keys(searchDataKey[0])[0];
        const sdkValue = searchDataKey[0][sdkKey];

        for (const dataDescriptor of mmrDescriptor.dataDescriptors) {
          const { label, message } = getDescriptorLabelAndMessage(dataDescriptor);
          if (label === sdkKey && (sdkValue === "" || message === sdkValue)) {
            matchFound = true;
            break;
          }
        }
      }

      if (!matchFound) continue;

      matches.push({
        id: attestationId,
        name: att?.name || "Attestation",
        raw: att,
        attestationDetails: { mmrDescriptor, signatureData },
        matchingDescriptors: isCollection ? matchingDescriptors : undefined,
      });
    } catch (e) {
      console.warn('Error parsing attestation while matching user data request:', e);
    }
  }

  return matches;
};

/**
 * Select best attestation(s) by blockchain height (newest first).
 * For single requests returns only the newest; for collection returns all sorted.
 */
const selectBestAttestations = async (matchingAttestations, isCollection) => {
  if (matchingAttestations.length === 0) return [];

  const withHeights = [];

  for (const attestation of matchingAttestations) {
    try {
      const signatureData = attestation.attestationDetails.signatureData;
      const sigInfo = await getSignatureInfo(
        signatureData.SystemID,
        signatureData.IdentityID,
        signatureData.signatureAsVch.toString('base64'),
      );
      withHeights.push({ ...attestation, height: sigInfo.height });
    } catch (error) {
      console.warn('Error getting height for attestation:', error);
    }
  }

  if (withHeights.length === 0) return [];

  // Sort by height (highest/newest first)
  withHeights.sort((a, b) => b.height - a.height);

  return isCollection ? withHeights : [withHeights[0]];
};

/**
 * @param {GenericRequest} request
 * @param {GenericResponse} response
 * @param {number} detailIndex
 * @returns {Promise<{
 *  displayProps: {
 *    detailsBufferString: string;
 *    requestSignerFqn?: string;
 *    requestSignerIdentityID?: string;
 *    requestSignerSystemID?: string;
 *    requestSigtime?: number;
 *    coinObj: any;
 *    chainInfo: any;
 *    dataType: number;
 *    requestType: number;
 *    searchDataKey: Array<{[key:string]:string}>;
 *    signerIAddress?: string;
 *    signerFqn?: string;
 *    requestIDDisplay?: string;
 *    requestedKeys?: string[];
 *    matchingAttestations: Array<any>;
 *    hasResponseURIs: boolean;
 *  };
 *  response: GenericResponse;
 *  handledIndices: Array<number>;
 * }>}
 */
export const handleUserDataRequestDetailsVDXFObject = async (request, response, detailIndex) => {
  /**
   * @type {UserDataRequestOrdinalVDXFObject}
   */
  const ordinalObj = request.getDetails(detailIndex);

  if (ordinalObj == null) throw new Error("Invalid index for request details");
  if (!(ordinalObj instanceof UserDataRequestOrdinalVDXFObject))
    throw new Error("User data request details not found at specified index");

  const details = ordinalObj.data;

  // Determine network
  let networkCoinId = 'VRSC';
  if (request.isTestnet && request.isTestnet()) {
    networkCoinId = 'VRSCTEST';
  }

  const coinObj = CoinDirectory.getBasicCoinObj(networkCoinId);
  VrpcProvider.initEndpoint(coinObj.system_id, coinObj.vrpc_endpoints[0]);

  const chainInfo = await getInfo(coinObj.system_id);
  if (chainInfo.error) throw new Error(chainInfo.error.message);

  // -- Resolve outer request signer info --
  let requestSignerFqn;
  let requestSignerIdentityID;
  let requestSignerSystemID;
  let requestSigtime;

  if (request.isSigned()) {
    requestSignerIdentityID = request.signature.identityID.toIAddress();
    requestSignerSystemID = request.signature.systemID.toIAddress();

    try {
      const signerSystemName = getSystemNameFromSystemId(requestSignerSystemID);
      if (signerSystemName) {
        const signerCoinObj = CoinDirectory.getBasicCoinObj(signerSystemName);
        VrpcProvider.initEndpoint(signerCoinObj.system_id, signerCoinObj.vrpc_endpoints[0]);

        const signedBy = await getIdentity(signerCoinObj.system_id, requestSignerIdentityID);
        if (!signedBy.error) {
          requestSignerFqn = convertFqnToDisplayFormat(signedBy.result.fullyqualifiedname);
        }

        const sigInfo = await getSignatureInfo(
          signerCoinObj.system_id,
          requestSignerIdentityID,
          request.signature.signatureAsVch.toString('base64'),
        );
        if (sigInfo.height) {
          const sigblock = await getBlock(signerCoinObj.system_id, sigInfo.height);
          if (!sigblock.error) {
            requestSigtime = sigblock.result.time;
          }
        }
      }
    } catch (e) {
      console.warn("Error getting request signature info:", e);
    }
  }

  // -- Extract fields from the UserDataRequestDetails --
  const dataType = details.dataType.toNumber();
  const requestType = details.requestType.toNumber();
  const searchDataKey = details.searchDataKey || [];
  const requestedKeys = details.hasRequestedKeys() ? (details.requestedKeys || []) : undefined;
  const requestIDDisplay = details.hasRequestID() && details.requestID
    ? details.requestID.toIAddress()
    : undefined;

  // -- Resolve signer friendly name if FLAG_HAS_SIGNER --
  let signerIAddress;
  let signerFqn;

  if (details.hasSigner() && details.signer) {
    signerIAddress = details.signer.toIAddress();
    try {
      const signerIdentity = await getIdentity(coinObj.system_id, signerIAddress);
      if (!signerIdentity.error) {
        signerFqn = convertFqnToDisplayFormat(signerIdentity.result.fullyqualifiedname);
      }
    } catch (e) {
      console.warn("Error resolving signer identity:", e);
    }
  }

  // -- Look up matching attestations from device storage --
  const isCollection = dataType === UserDataRequestDetails.COLLECTION.toNumber();
  let matchingAttestations = [];

  try {
    const attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
    if (attestationData && Object.keys(attestationData).length > 0) {
      const allMatches = findMatchingAttestations(
        searchDataKey,
        signerIAddress || null,
        isCollection,
        attestationData,
      );
      matchingAttestations = await selectBestAttestations(allMatches, isCollection);
    }
  } catch (e) {
    console.warn("Error loading attestation data:", e);
    // matchingAttestations stays empty — UI will show "no data found"
  }

  // -- Find the auth detail index so we can mark it handled --
  const authDetailIndex = request.details.findIndex(
    x => x instanceof AuthenticationRequestOrdinalVDXFObject,
  );
  const handledIndices = authDetailIndex >= 0 ? [authDetailIndex] : [];

  const hasResponseURIs = !!(
    request.hasResponseURIs &&
    request.hasResponseURIs() &&
    request.responseURIs &&
    request.responseURIs.length > 0
  );

  return {
    displayProps: {
      detailsBufferString: details.toBuffer().toString('hex'),
      requestSignerFqn,
      requestSignerIdentityID,
      requestSignerSystemID,
      requestSigtime,
      coinObj,
      chainInfo: chainInfo.result,
      dataType,
      requestType,
      searchDataKey,
      signerIAddress,
      signerFqn,
      requestIDDisplay,
      requestedKeys,
      matchingAttestations,
      hasResponseURIs,
    },
    response,
    handledIndices,
  };
};
