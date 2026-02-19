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
 *    sigtime?: number;
 *    signerFqn?: string;
 *    signerSystemID?: string;
 *    signerSystemName?: string;
 *    signerIdentityID?: string;
 *    isSignatureValid?: boolean;
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

  // Determine if testnet based on flags or default to mainnet
  const coinObj = CoinDirectory.getBasicCoinObj('VRSC');
  VrpcProvider.initEndpoint(coinObj.system_id, coinObj.vrpc_endpoints[0]);

  // Get chain info
  const chainInfo = await getInfo(coinObj.system_id);
  if (chainInfo.error) throw new Error(chainInfo.error.message);

  // Check for embedded signature within the data packet details
  let isSignatureValid = undefined;
  let sigtime = undefined;
  let signerFqn = undefined;
  let signerIdentityID = undefined;
  let signerSystemID = undefined;

  if (details.hasSignature() && details.signature) {
    // Extract the signature from the details
    const embeddedSignature = details.signature;
    
    // Create a copy of details without the signature for verification
    // The signed data is the DataPacketRequestDetails without the signature field
    const detailsForVerification = new DataPacketRequestDetails({
      version: details.version,
      flags: details.flags.and(DataPacketRequestDetails.FLAG_HAS_SIGNATURE.notn(256)), // Remove signature flag
      signableObjects: details.signableObjects,
      statements: details.statements,
      requestID: details.requestID,
      // signature is intentionally omitted
    });

    // Get the buffer of the unsigned details - this is what was signed
    const signedDataBuffer = detailsForVerification.toBuffer();
    const signedDataHash = createHash("sha256").update(signedDataBuffer).digest();
    
    // Extract signer info from embedded signature
    signerIdentityID = embeddedSignature.identityID?.toIAddress?.();
    signerSystemID = embeddedSignature.systemID?.toIAddress?.();

    if (signerIdentityID && signerSystemID) {
      try {
        // Get signature info to extract block height
        const sigInfo = await getSignatureInfo(
          signerSystemID,
          signerIdentityID,
          embeddedSignature.signatureAsVch.toString('base64')
        );

        // Verify the hash
        const hashToVerify = embeddedSignature.getIdentityHash(
          sigInfo.height,
          signedDataHash
        );
 
        const verified = await verifyHash(
          signerSystemID,
          signerIdentityID,
          embeddedSignature.signatureAsVch.toString('base64'),
          hashToVerify
        );

        isSignatureValid = !!verified;

        // Get signature time from block
        if (sigInfo.height) {
          const sigblock = await getBlock(signerSystemID, sigInfo.height);
          if (!sigblock.error) {
            sigtime = sigblock.result.time;
          }
        }

        // Get signer friendly name
        const signedBy = await getIdentity(signerSystemID, signerIdentityID);
        if (!signedBy.error) {
          signerFqn = convertFqnToDisplayFormat(signedBy.result.fullyqualifiedname);
        }
      } catch (e) {
        console.warn("Error verifying embedded signature:", e);
        isSignatureValid = false;
      }
    }
  }

  // Also check main request signature if present
  if (request.isSigned() && !signerIdentityID) {
    signerIdentityID = request.signature.identityID.toIAddress();
    signerSystemID = request.signature.systemID.toIAddress();

    try {
      const sigInfo = await getSignatureInfo(
        signerSystemID,
        signerIdentityID,
        request.signature.signatureAsVch.toString('base64')
      );

      if (sigInfo.height) {
        const sigblock = await getBlock(signerSystemID, sigInfo.height);
        if (!sigblock.error) {
          sigtime = sigblock.result.time;
        }
      }

      const signedBy = await getIdentity(signerSystemID, signerIdentityID);
      if (!signedBy.error) {
        signerFqn = convertFqnToDisplayFormat(signedBy.result.fullyqualifiedname);
      }
    } catch (e) {
      console.warn("Error getting request signature info:", e);
    }
  }

  displayProps = {
    detailsBufferString: details.toBuffer().toString('hex'),
    isSigned: !!(details.hasSignature() || request.isSigned()),
    sigtime,
    signerFqn,
    signerSystemID,
    signerIdentityID,
    isSignatureValid,
    coinObj,
    chainInfo: chainInfo.result,
  };

  return {
    displayProps,
    response,
    handledIndices: []
  };
}
