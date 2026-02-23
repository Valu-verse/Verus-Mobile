import { DataPacketRequestOrdinalVDXFObject, DataPacketRequestDetails, AuthenticationRequestOrdinalVDXFObject, GenericRequest } from "verus-typescript-primitives/dist/vdxf/classes";
import { BN } from "bn.js";

/**
 * @param {GenericRequest} request 
 * @param {number} detailIndex
 */
export const validateDataPacketRequestVDXFObject = (request, detailIndex) => {
  const detailsObject = request.getDetails(detailIndex);

  if (!(detailsObject instanceof DataPacketRequestOrdinalVDXFObject)) {
    throw new Error("Data packet request details not found at specified index");
  }

  if (detailsObject.data == null || !detailsObject.data.isValid()) {
    throw new Error("Invalid data packet request details.");
  }

  const details = detailsObject.data;

  // ── signableObjects always required ──
  if (!details.signableObjects || details.signableObjects.length === 0) {
    throw new Error("signableObjects must be a non-empty array.");
  }

  // ── Data-carrying flag consistency (bits 0-2) ──

  // FLAG_HAS_REQUEST_ID
  if (details.hasRequestID() && !details.requestID) {
    throw new Error("FLAG_HAS_REQUEST_ID is set but requestID is missing.");
  }
  if (!details.hasRequestID() && details.requestID) {
    throw new Error("requestID is present but FLAG_HAS_REQUEST_ID is not set.");
  }

  // FLAG_HAS_STATEMENTS
  if (details.hasStatements() && (!details.statements || details.statements.length === 0)) {
    throw new Error("FLAG_HAS_STATEMENTS is set but statements are missing or empty.");
  }
  if (!details.hasStatements() && details.statements && details.statements.length > 0) {
    throw new Error("Statements are present but FLAG_HAS_STATEMENTS is not set.");
  }

  // FLAG_HAS_SIGNATURE
  if (details.hasSignature() && !details.signature) {
    throw new Error("FLAG_HAS_SIGNATURE is set but signature is missing.");
  }
  if (!details.hasSignature() && details.signature) {
    throw new Error("Signature is present but FLAG_HAS_SIGNATURE is not set.");
  }

  // ── Behavioural flag constraints (bits 3-5) ──

  // FLAG_FOR_USERS_SIGNATURE (0x08): GenericRequest must contain responseURIs
  const isForUserSignature = details.flags.and(DataPacketRequestDetails.FLAG_FOR_USERS_SIGNATURE).gt(new BN(0));
  if (isForUserSignature) {
    if (!request.hasResponseURIs || !request.hasResponseURIs() || !request.responseURIs || request.responseURIs.length === 0) {
      throw new Error("FLAG_FOR_USERS_SIGNATURE requires responseURIs in the GenericRequest so the signed response can be returned.");
    }
  }

  // FLAG_FOR_TRANSMITTAL_TO_USER (0x10): AuthenticationRequestOrdinalVDXFObject
  // must exist and precede the data packet in the details array
  const isForTransmittal = details.flags.and(DataPacketRequestDetails.FLAG_FOR_TRANSMITTAL_TO_USER).gt(new BN(0));
  if (isForTransmittal) {
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
        "FLAG_FOR_TRANSMITTAL_TO_USER requires an AuthenticationRequestOrdinalVDXFObject " +
        "preceding the data packet in the details array."
      );
    }
  }
}
