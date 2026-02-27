import { DataPacketRequestOrdinalVDXFObject, DataPacketRequestDetails, GenericRequest, GenericResponse, VerifiableSignatureData } from "verus-typescript-primitives";
import VrpcProvider from '../../vrpc/vrpcInterface';
import { getBlock, getInfo } from "../../api/channels/vrpc/callCreators";
import { getSignatureInfo } from "../../api/channels/vrpc/requests/getSignatureInfo";
import { verifyHash } from "../../api/channels/vrpc/requests/verifyHash";
import { getIdentity } from "../../api/channels/verusid/callCreators";
import { CoinDirectory } from "../../CoinData/CoinDirectory";
import { getSystemNameFromSystemId } from "../../CoinData/CoinData";
import { convertFqnToDisplayFormat } from "../../fullyqualifiedname";
import { BN } from "bn.js";
const createHash = require("create-hash");

/**
 * @param {GenericRequest} request
 * @param {GenericResponse} response
 * @param {number} detailIndex
 * @returns {Promise<{
 *  displayProps: {
 *    detailsBufferString: string;
 *    isSigned: boolean;
 *    requestSignerFqn?: string;
 *    requestSignerIdentityID?: string;
 *    requestSignerSystemID?: string;
 *    requestSigtime?: number;
 *    embeddedSignerFqn?: string;
 *    embeddedSignerIdentityID?: string;
 *    embeddedSignerSystemID?: string;
 *    embeddedSigtime?: number;
 *    embeddedIsSignatureValid?: boolean;
 *    coinObj?: any;
 *  }
 *  response: GenericResponse;
 *  handledIndices: Array<number>;
 * }>}
 */
export const handleDataPacketRequestDetailsVDXFObject = async (request, response, detailIndex) => {
  /**
   * @type {DataPacketRequestOrdinalVDXFObject}
   */
  const ordinalObj = request.getDetails(detailIndex);

  if (ordinalObj == null) throw new Error("Invalid index for request details");
  if (!(ordinalObj instanceof DataPacketRequestOrdinalVDXFObject)) throw new Error("Data packet request details not found at specified index");

  const details = ordinalObj.data;
  let displayProps = {};

  // Determine network: use the embedded signature's systemID if available,
  // otherwise fall back to request.isTestnet(), otherwise default to mainnet.
  let networkCoinId = 'VRSC';
  if (details.hasSignature() && details.signature) {
    const sigSystemId = details.signature.systemID?.toIAddress?.();
    if (sigSystemId) {
      const sigSystemName = getSystemNameFromSystemId(sigSystemId);
      if (sigSystemName) networkCoinId = sigSystemName;
    }
  }
  if (networkCoinId === 'VRSC' && request.isTestnet && request.isTestnet()) {
    networkCoinId = 'VRSCTEST';
  }

  const coinObj = CoinDirectory.getBasicCoinObj(networkCoinId);
  VrpcProvider.initEndpoint(coinObj.system_id, coinObj.vrpc_endpoints[0]);

  // Get chain info
  const chainInfo = await getInfo(coinObj.system_id);
  if (chainInfo.error) throw new Error(chainInfo.error.message);

  // Check for embedded signature within the data packet details
  let embeddedIsSignatureValid = undefined;
  let embeddedSigtime = undefined;
  let embeddedSignerFqn = undefined;
  let embeddedSignerIdentityID = undefined;
  let embeddedSignerSystemID = undefined;

  if (details.hasSignature() && details.signature) {
    // Extract the signature from the details
    const embeddedSignature = details.signature;
    
    // Create a copy of details without the signature data for verification.
    // The signed data is the DataPacketRequestDetails with FLAG_HAS_SIGNATURE
    // still set in flags, but without the actual signature bytes serialized.
    // This matches the signing convention where the flag indicates a signature
    // will be present, but the signature itself is not part of the signed message.
    const detailsForVerification = new DataPacketRequestDetails({
      version: details.version,
      flags: details.flags, // Keep FLAG_HAS_SIGNATURE in flags - it's part of the signed data
      signableObjects: details.signableObjects,
      statements: details.statements,
      requestID: details.requestID,
      // signature is intentionally omitted - toBuffer() skips writing it when undefined
    });

    // Get the buffer of the unsigned details - this is what was signed
    const signedDataBuffer = detailsForVerification.toBuffer();
    const signedDataHash = createHash("sha256").update(signedDataBuffer).digest();
    // Extract signer info from embedded signature
    embeddedSignerIdentityID = embeddedSignature.identityID?.toIAddress?.();
    embeddedSignerSystemID = embeddedSignature.systemID?.toIAddress?.();

    if (embeddedSignerIdentityID && embeddedSignerSystemID) {
      try {
        // Ensure the endpoint for the signer's system is initialized
        const signerSystemName = getSystemNameFromSystemId(embeddedSignerSystemID);
        if (signerSystemName) {
          const signerCoinObj = CoinDirectory.getBasicCoinObj(signerSystemName);
          VrpcProvider.initEndpoint(signerCoinObj.system_id, signerCoinObj.vrpc_endpoints[0]);
        }

        // Get signature info to extract block height
        const sigInfo = await getSignatureInfo(
          embeddedSignerSystemID,
          embeddedSignerIdentityID,
          embeddedSignature.signatureAsVch.toString('base64')
        );

        // Verify the hash
        const hashToVerify = embeddedSignature.getIdentityHash(
          sigInfo.height,
          signedDataHash
        );
        const verified = await verifyHash(
          embeddedSignerSystemID,
          embeddedSignerIdentityID,
          embeddedSignature.signatureAsVch.toString('base64'),
          hashToVerify
        );

        embeddedIsSignatureValid = !!verified;

        // Get signature time from block
        if (sigInfo.height) {
          const sigblock = await getBlock(embeddedSignerSystemID, sigInfo.height);
          if (!sigblock.error) {
            embeddedSigtime = sigblock.result.time;
          }
        }

        // Get signer friendly name
        const signedBy = await getIdentity(embeddedSignerSystemID, embeddedSignerIdentityID);
        if (!signedBy.error) {
          embeddedSignerFqn = convertFqnToDisplayFormat(signedBy.result.fullyqualifiedname);
        }
      } catch (e) {
        console.warn("Error verifying embedded signature:", e);
        embeddedIsSignatureValid = false;
      }
    }
  }

  // Also extract main request signature info if present
  let requestSignerFqn = undefined;
  let requestSignerIdentityID = undefined;
  let requestSignerSystemID = undefined;
  let requestSigtime = undefined;

  if (request.isSigned()) {
    requestSignerIdentityID = request.signature.identityID.toIAddress();
    requestSignerSystemID = request.signature.systemID.toIAddress();

    try {
      const sigInfo = await getSignatureInfo(
        requestSignerSystemID,
        requestSignerIdentityID,
        request.signature.signatureAsVch.toString('base64')
      );

      if (sigInfo.height) {
        const sigblock = await getBlock(requestSignerSystemID, sigInfo.height);
        if (!sigblock.error) {
          requestSigtime = sigblock.result.time;
        }
      }

      const signedBy = await getIdentity(requestSignerSystemID, requestSignerIdentityID);
      if (!signedBy.error) {
        requestSignerFqn = convertFqnToDisplayFormat(signedBy.result.fullyqualifiedname);
      }
    } catch (e) {
      console.warn("Error getting request signature info:", e);
    }
  }

  displayProps = {
    detailsBufferString: details.toBuffer().toString('hex'),
    isSigned: !!(details.hasSignature() || request.isSigned()),
    requestSignerFqn,
    requestSignerIdentityID,
    requestSignerSystemID,
    requestSigtime,
    embeddedSignerFqn,
    embeddedSignerIdentityID,
    embeddedSignerSystemID,
    embeddedSigtime,
    embeddedIsSignatureValid,
    coinObj,
    chainInfo: chainInfo.result,
  };

  return {
    displayProps,
    response,
    handledIndices: []
  };
}
