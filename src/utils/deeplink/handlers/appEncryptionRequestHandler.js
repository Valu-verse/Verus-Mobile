/*
 * appEncryptionRequestHandler.js
 * 
 * Handles AppEncryptionRequest from GenericRequest envelope.
 * Shows user approval UI before deriving encryption keys.
 */

import { 
  AppEncryptionRequestDetails,
  AppEncryptionResponseDetails,
  AppEncryptionRequestOrdinalVDXFObject,
  AppEncryptionResponseOrdinalVDXFObject,
  SaplingPaymentAddress,
  DataDescriptor,
  DataDescriptorOrdinalVDXFObject,
  GenericRequest,
  GenericResponse,
} from "verus-typescript-primitives";

import { SaplingExtendedViewingKey } from "verus-typescript-primitives/dist/pbaas/SaplingExtendedViewingKey";
import { SaplingExtendedSpendingKey } from "verus-typescript-primitives/dist/pbaas/SaplingExtendedSpendingKey";

import { BN } from "bn.js";
import { CoinDirectory } from "../../CoinData/CoinDirectory";
import VrpcProvider from "../../vrpc/vrpcInterface";
import store from "../../../store";
import { getIdentity } from "../../api/channels/verusid/callCreators";
import { getSystemNameFromSystemId } from "../../CoinData/CoinData";
import { convertFqnToDisplayFormat } from "../../fullyqualifiedname";
import { getBlock } from "../../api/channels/vrpc/requests/getBlock";
import { getSignatureInfo } from "../../api/channels/vrpc/requests/getSignatureInfo";

import { requestPrivKey } from "../../auth/authBox";
import { DLIGHT_PRIVATE } from "../../constants/intervalConstants";

import { z_getencryptionaddress } from "../../api/channels/dlight/requests/zGetEncryptionAddress";
import { encryptVerusMessage } from "../../api/channels/dlight/requests/encrypt";

// Configuration

// Set to false when real z_functions are available
const USE_MOCK_Z_FUNCTIONS = true;

/**
 * Gets the Extended Spending Key from the wallet
 * @param {string} systemID - The system ID (VRSC or VRSCTEST)
 * @returns {Promise<string>} The ESK
 * @throws {Error} If ESK cannot be retrieved
 */
const getExtendedSpendingKey = async (systemID) => {
  const coinId = CoinDirectory.getBasicCoinObj(systemID);
  try {
    const esk = await requestPrivKey(coinId.id, DLIGHT_PRIVATE);
    
    if (!esk) {
      throw new Error(`extended spending key not available for ${coinId}`);
    }
    
    return esk;
  } catch (e) {
    throw new Error(`failed to retrieve extended spending key: ${e.message}`);
  }
};

// remove when tested with real functions

const mock_z_getencryptionaddress = async (systemID, params) => {
  return {
    err: false,
    result: {
      ivk: "a".repeat(64),
    }
  };
};

const mock_encryptVerusMessage = async (systemID, toAddress, data, returnSsk) => {
  return {
    err: false,
    result: data
  };
};


// ============================================================================
// z_function Wrappers
// ============================================================================

const callZGetEncryptionAddress = async (systemID, params) => {
  if (USE_MOCK_Z_FUNCTIONS) {
    return mock_z_getencryptionaddress(systemID, params);
  }

    return z_getencryptionaddress(systemID, params);
};

const callEncryptVerusMessage = async (systemID, toAddress, data, returnSsk) => {
  if (USE_MOCK_Z_FUNCTIONS) {
    return mock_encryptVerusMessage(systemID, toAddress, data, returnSsk);
  }
    return encryptVerusMessage(systemID, toAddress, data, returnSsk);
};


// ============================================================================
// Main Handler
// ============================================================================

// ============================================================================
// Main Handler - Returns displayProps for UI
// ============================================================================

/**
 * Entry point called from GenericRequestHome.
 * Prepares display props for AppEncryptionRequestInfo UI.
 * Actual key derivation happens after user approval.
 * 
 * @param {GenericRequest} request - The parent GenericRequest
 * @param {GenericResponse} response - The response being built
 * @param {number} detailIndex - Index of this detail in request.details
 * @returns {Promise<{ displayProps: object, response: GenericResponse, handledIndices: number[] }>}
 * @throws {Error} If processing fails
 */
export const handleAppEncryptionRequestVDXFObject = async (request, response, detailIndex) => {
  const detail = request.getDetails(detailIndex);
  
  if (!detail || !(detail instanceof AppEncryptionRequestOrdinalVDXFObject)) {
    throw new Error("Invalid AppEncryptionRequest detail at index " + detailIndex);
  }
  
  const encryptionRequest = detail.data;
  const systemID = request.signature.systemID.toIAddress();
  const requestSignerID = request.signature.identityID.toIAddress();

  const coinObj = CoinDirectory.getBasicCoinObj(systemID);
  
  if (!coinObj) {
    throw new Error("Unsupported system: " + systemID);
  }
  
  VrpcProvider.initEndpoint(coinObj.system_id, coinObj.vrpc_endpoints[0]);

  // Resolve signer identity to FQN
  let signerFqn = requestSignerID;
  let signerSystemName = getSystemNameFromSystemId(systemID);
  let sigtime = null;

  try {
    const signedBy = await getIdentity(coinObj.system_id, requestSignerID);
    if (!signedBy.error && signedBy.result?.fullyqualifiedname) {
      signerFqn = convertFqnToDisplayFormat(signedBy.result.fullyqualifiedname);
    }

    // Get signature timestamp
    const sig = await getSignatureInfo(
      coinObj.system_id,
      request.signature.identityID.toIAddress(),
      request.signature.signatureAsVch.toString('base64')
    );

    if (sig && sig.height != null) {
      const sigblock = await getBlock(coinObj.system_id, sig.height);
      if (!sigblock.error && sigblock.result) {
        sigtime = sigblock.result.time;
      }
    }
  } catch (e) {
    console.warn("Unable to load signer metadata for app encryption request", e?.message ?? e);
  }

  // Resolve derivationID to FQN if present
  let derivationIdFqn = null;
  if (encryptionRequest.hasDerivationID()) {
    const derivationIdAddr = encryptionRequest.derivationID.toIAddress();
    derivationIdFqn = derivationIdAddr;
    try {
      const derivationIdentity = await getIdentity(coinObj.system_id, derivationIdAddr);
      if (!derivationIdentity.error && derivationIdentity.result?.fullyqualifiedname) {
        derivationIdFqn = convertFqnToDisplayFormat(derivationIdentity.result.fullyqualifiedname);
      }
    } catch (e) {
      console.warn("Unable to resolve derivationID", e);
    }
  }

  // Resolve requestID to FQN if present
  let requestIdFqn = null;
  if (encryptionRequest.hasRequestID()) {
    const requestIdAddr = encryptionRequest.requestID.toIAddress();
    requestIdFqn = requestIdAddr;
    try {
      const requestIdentity = await getIdentity(coinObj.system_id, requestIdAddr);
      if (!requestIdentity.error && requestIdentity.result?.fullyqualifiedname) {
        requestIdFqn = convertFqnToDisplayFormat(requestIdentity.result.fullyqualifiedname);
      }
    } catch (e) {
      // Keep raw i-address if resolution fails
    }
  }

  // Get encrypt response to address if present
  let encryptResponseToAddress = null;
  if (encryptionRequest.hasEncryptResponseToAddress()) {
    encryptResponseToAddress = encryptionRequest.encryptResponseToAddress.toAddressString();
  }

  return {
    displayProps: {
      detailsBufferString: detail.data.toBuffer().toString('hex'),
      signerFqn,
      signerSystemID: systemID,
      signerSystemName,
      signerIdentityID: requestSignerID,
      sigtime,
      derivationNumber: encryptionRequest.derivationNumber.toNumber(),
      derivationIdFqn,
      hasDerivationID: encryptionRequest.hasDerivationID(),
      requestIdFqn,
      hasRequestID: encryptionRequest.hasRequestID(),
      encryptResponseToAddress,
      hasEncryptResponseToAddress: encryptionRequest.hasEncryptResponseToAddress(),
      returnESK: encryptionRequest.returnESK(),
    },
    response,
    handledIndices: []
  };
};



// ============================================================================
// Processing Function - Called after user approval
// ============================================================================

/**
 * Derives keys and builds the response object.
 * Called by AppEncryptionRequestInfo after user approval.
 * 
 * @param {Object} params
 * @param {GenericRequest} params.request - The parent GenericRequest
 * @param {number} params.detailIndex - Index of the encryption request detail
 * @param {string} params.responseSignerID - The user's signing identity i-address
 * @returns {Promise<AppEncryptionResponseOrdinalVDXFObject|DataDescriptorOrdinalVDXFObject>}
 * @throws {Error} If processing fails
 */
export const processAppEncryptionRequest = async ({
  request,
  detailIndex,
  responseSignerID,
}) => {
  const detail = request.getDetails(detailIndex);
  
  if (!detail || !(detail instanceof AppEncryptionRequestOrdinalVDXFObject)) {
    throw new Error("Invalid AppEncryptionRequest detail at index " + detailIndex);
  }
  
  const encryptionRequest = detail.data;
  const systemID = request.signature.systemID.toIAddress();
  const requestSignerID = request.signature.identityID.toIAddress();
  
  // Get appOrDelegatedID if present
  let appOrDelegatedID = null;
  try {
    if (request.appOrDelegatedID) {
      appOrDelegatedID = request.appOrDelegatedID.toAddress();
    }
  } catch (e) {
    // appOrDelegatedID is optional
  }

  const coinObj = CoinDirectory.getBasicCoinObj(systemID);
  
  if (!coinObj) {
    throw new Error("Unsupported system: " + systemID);
  }

  // Get ESK for key derivation
  const eskForDerivation = await getExtendedSpendingKey(coinObj.id);

  // Use appOrDelegatedID if present, otherwise use requestSignerID
  const appID = appOrDelegatedID || requestSignerID;

  // Check if spending key requested via flags
  const returnESK = encryptionRequest.returnESK();

  // Build derivation params
  const derivationParams = {
    spendingKey: eskForDerivation,
    fromId: responseSignerID,
    toId: appID,
    hdIndex: 0,
    encryptionIndex: encryptionRequest.derivationNumber.toNumber(),
    returnSecret: returnESK
  };

  // Derive channel keys
  const derivationResult = await callZGetEncryptionAddress(coinObj.system_id, derivationParams);

  if (derivationResult.err) {
    throw new Error("Key derivation failed: " + (derivationResult.err.message || derivationResult.err));
  }

  const keys = derivationResult.result;

  // Build response details
  let responseDetails;
  let responseFlags = new BN(0);

  // Set flags based on what we're returning
  if (encryptionRequest.hasRequestID()) {
    responseFlags = responseFlags.or(new BN(1)); // FLAG_HAS_REQUEST_ID
  }
  if (returnESK) {
    responseFlags = responseFlags.or(new BN(2)); // FLAG_HAS_EXTENDED_SPENDING_KEY
  }

  if (USE_MOCK_Z_FUNCTIONS) {
    // Mock mode: create mock objects with valid buffers
    const mockAddress = new SaplingPaymentAddress();
    mockAddress.d = Buffer.alloc(11).fill(0x01);
    mockAddress.pk_d = Buffer.alloc(32).fill(0x02);

    const mockFvk = new SaplingExtendedViewingKey();
    mockFvk.depth = 0;
    mockFvk.parentFVKTag = Buffer.alloc(4);
    mockFvk.childIndex = Buffer.alloc(4);
    mockFvk.chainCode = Buffer.alloc(32);
    mockFvk.ak = Buffer.alloc(32);
    mockFvk.nk = Buffer.alloc(32);
    mockFvk.ovk = Buffer.alloc(32);
    mockFvk.dk = Buffer.alloc(32);

    responseDetails = new AppEncryptionResponseDetails({
      version: new BN(1),
      flags: responseFlags,
      incomingViewingKey: Buffer.alloc(32).fill(0xaa),
      extendedViewingKey: mockFvk,
      address: mockAddress,
      requestID: encryptionRequest.hasRequestID() ? encryptionRequest.requestID : undefined,
    });
  } else {
    // Real mode: parse actual keys from z_getencryptionaddress
    if (!keys.ivk || !keys.fvk || !keys.address) {
      throw new Error("Incomplete key derivation result");
    }

    if (returnESK && !keys.spending_key) {
      throw new Error("Spending key requested but not returned");
    }

    responseDetails = new AppEncryptionResponseDetails({
      version: new BN(1),
      flags: responseFlags,
      incomingViewingKey: Buffer.from(keys.ivk, 'hex'),
      extendedViewingKey: SaplingExtendedViewingKey.fromKeyString(keys.fvk),
      address: SaplingPaymentAddress.fromAddressString(keys.address),
      extendedSpendingKey: returnESK
        ? SaplingExtendedSpendingKey.fromKeyString(keys.spending_key) 
        : undefined,
      requestID: encryptionRequest.hasRequestID() ? encryptionRequest.requestID : undefined,
    });
  }

  // Get the encrypt to address or return null as it's optional
  const encryptTo = encryptionRequest.hasEncryptResponseToAddress() 
    ? encryptionRequest.encryptResponseToAddress.toAddressString() 
    : null;

  if (!encryptTo) {
    // Return unencrypted response
    return new AppEncryptionResponseOrdinalVDXFObject({
      data: responseDetails
    });
  }

  // Encrypt response
  const responseBuffer = responseDetails.toBuffer();
  const responseHex = responseBuffer.toString("hex");

  const encryptResult = await callEncryptVerusMessage(
    coinObj.system_id,
    encryptTo,
    responseHex,
    true
  );

  if (encryptResult.err) {
    throw new Error("Encryption failed: " + (encryptResult.err.message || encryptResult.err));
  }
  
  const encryptedData = encryptResult.result;

  // Wrap encrypted data in DataDescriptor
  const encryptedDescriptor = new DataDescriptor({
    flags: DataDescriptor.FLAG_ENCRYPTED_DATA,
    objectdata: Buffer.from(typeof encryptedData === 'string' ? encryptedData : encryptedData.ciphertext, 'hex'),
    epk: encryptedData.epk ? Buffer.from(encryptedData.epk, 'hex') : undefined,
  });

  return new DataDescriptorOrdinalVDXFObject({
    data: encryptedDescriptor
  });
};


export default {
  handleAppEncryptionRequestVDXFObject,
  processAppEncryptionRequest
};


