import { UserDataRequestOrdinalVDXFObject, UserDataRequestDetails, AuthenticationRequestOrdinalVDXFObject, GenericRequest } from "verus-typescript-primitives/dist/vdxf/classes";
import { BN } from "bn.js";

/**
 * @param {GenericRequest} request 
 * @param {number} detailIndex
 */
export const validateUserDataRequestVDXFObject = (request, detailIndex) => {
  const detailsObject = request.getDetails(detailIndex);

  if (!(detailsObject instanceof UserDataRequestOrdinalVDXFObject)) {
    throw new Error("User data request details not found at specified index");
  }

  if (detailsObject.data == null || !detailsObject.data.isValid()) {
    throw new Error("Invalid user data request details.");
  }

  const details = detailsObject.data;

  // ── searchDataKey always required ──
  if (!details.searchDataKey || details.searchDataKey.length === 0) {
    throw new Error("searchDataKey must be a non-empty array.");
  }

  // ── dataType must be 1, 2, or 3 ──
  if (!details.dataType || typeof details.dataType.toNumber !== 'function') {
    throw new Error("dataType is missing or not a valid BN instance.");
  }
  const dt = details.dataType.toNumber();
  if (dt < 1 || dt > 3) {
    throw new Error(`Invalid dataType: ${dt}. Must be 1 (FULL_DATA), 2 (PARTIAL_DATA), or 3 (COLLECTION).`);
  }

  // ── requestType must be 1, 2, or 3 ──
  if (!details.requestType || typeof details.requestType.toNumber !== 'function') {
    throw new Error("requestType is missing or not a valid BN instance.");
  }
  const rt = details.requestType.toNumber();
  if (rt < 1 || rt > 3) {
    throw new Error(`Invalid requestType: ${rt}. Must be 1 (ATTESTATION), 2 (CLAIM), or 3 (CREDENTIAL).`);
  }

  // ── Flag / data consistency (bits 0-2) ──

  // FLAG_HAS_REQUEST_ID
  if (details.hasRequestID() && !details.requestID) {
    throw new Error("FLAG_HAS_REQUEST_ID is set but requestID is missing.");
  }
  if (!details.hasRequestID() && details.requestID) {
    throw new Error("requestID is present but FLAG_HAS_REQUEST_ID is not set.");
  }

  // FLAG_HAS_SIGNER
  if (details.hasSigner() && !details.signer) {
    throw new Error("FLAG_HAS_SIGNER is set but signer is missing.");
  }
  if (!details.hasSigner() && details.signer) {
    throw new Error("signer is present but FLAG_HAS_SIGNER is not set.");
  }

  // FLAG_HAS_REQUESTED_KEYS
  if (details.hasRequestedKeys() && (!details.requestedKeys || details.requestedKeys.length === 0)) {
    throw new Error("FLAG_HAS_REQUESTED_KEYS is set but requestedKeys are missing or empty.");
  }
  if (!details.hasRequestedKeys() && details.requestedKeys && details.requestedKeys.length > 0) {
    throw new Error("requestedKeys are present but FLAG_HAS_REQUESTED_KEYS is not set.");
  }

  // ── dataType ↔ requestedKeys cross-constraints ──

  const isPartialData = UserDataRequestDetails.PARTIAL_DATA && dt === UserDataRequestDetails.PARTIAL_DATA.toNumber();
  const isFullData = UserDataRequestDetails.FULL_DATA && dt === UserDataRequestDetails.FULL_DATA.toNumber();
  const isCollection = UserDataRequestDetails.COLLECTION && dt === UserDataRequestDetails.COLLECTION.toNumber();

  // PARTIAL_DATA requires requestedKeys
  if (isPartialData && !details.hasRequestedKeys()) {
    throw new Error("PARTIAL_DATA requires FLAG_HAS_REQUESTED_KEYS to be set with requestedKeys.");
  }

  // FULL_DATA and COLLECTION forbid requestedKeys
  if ((isFullData || isCollection) && details.hasRequestedKeys()) {
    throw new Error(
      `FLAG_HAS_REQUESTED_KEYS is not allowed with ${isFullData ? 'FULL_DATA' : 'COLLECTION'}.`
    );
  }

  // ── GenericRequest-level constraints ──

  // An AuthenticationRequestOrdinalVDXFObject must precede the user data request
  let foundAuthBefore = false;
  for (let i = 0; i < detailIndex; i++) {
    const precedingDetail = request.getDetails(i);
    if (precedingDetail instanceof AuthenticationRequestOrdinalVDXFObject) {
      foundAuthBefore = true;
      break;
    }
  }
  if (!foundAuthBefore) {
    throw new Error(
      "UserDataRequestOrdinalVDXFObject requires an AuthenticationRequestOrdinalVDXFObject " +
      "preceding it in the details array."
    );
  }

  // responseURIs should be present
  if (!request.hasResponseURIs || !request.hasResponseURIs() || !request.responseURIs || request.responseURIs.length === 0) {
    throw new Error(
      "UserDataRequestOrdinalVDXFObject requires responseURIs in the GenericRequest " +
      "so the user's data can be returned."
    );
  }
}
