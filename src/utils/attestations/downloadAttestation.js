import { handleRedirect } from '../deeplink/handleRedirect';
import { primitives } from 'verusid-ts-client';
import { AttestationDetails } from "verus-typescript-primitives/dist/vdxf/classes/attestation/AttestationDetails.js";

/**
 * Downloads attestation data from a provider URL using webhook redirect
 * @param {string} url - The attestation provider URL
 * @param {Object} requestData - Optional request data to send to the attestation provider
 * @returns {Promise<Object>} The raw attestation response data
 */
export const downloadAttestationData = async (url, requestData = {}) => {
  try {
    if (!url) {
      throw new Error('No attestation provision URL provided');
    }

    // Use handleRedirect with LOGIN_CONSENT_WEBHOOK_VDXF_KEY to fetch data
    const response = await handleRedirect(requestData, {
      vdxfkey: primitives.LOGIN_CONSENT_WEBHOOK_VDXF_KEY.vdxfid,
      uri: url
    });

    if (!response || !response.data) {
      throw new Error('No data received from attestation provider');
    }

    // Return the raw response data for AttestationDetails parsing
    return response.data;
  } catch (error) {
    console.error('Error downloading attestation data:', error);
    throw new Error(`Failed to download attestation: ${error.message}`);
  }
};

/**
 * Downloads and processes attestation data for the LoginReceiveAttestation component
 * @param {Object} req - The login consent request object
 * @param {Function} setLoading - Function to set loading state
 * @param {Function} setIsDownloadingAttestation - Function to set downloading state
 * @param {Function} setDownloadedAttestations - Function to set downloaded attestations
 * @param {Function} createAlert - Function to create alerts
 * @returns {Promise<AttestationDetails>} The downloaded attestation details
 */
export const downloadAndProcessAttestationData = async (req, setLoading, setIsDownloadingAttestation, setDownloadedAttestations, createAlert) => {
  try {
    setLoading(true);
    setIsDownloadingAttestation(true);

    const attestationProvisionUrl = req.challenge.redirect_uris.find(
      uri => uri.vdxfkey === primitives.ATTESTATION_PROVISION_URL.vdxfid
    );

    const attestationResponse = await downloadAttestationData(attestationProvisionUrl.uri);
    const attestationDetails = AttestationDetails.fromJson(attestationResponse);

    if (!attestationResponse || !attestationDetails.isValid() || attestationDetails.attestations.length === 0) {
      throw new Error("Invalid or empty attestation details");
    }

    setDownloadedAttestations(attestationDetails);
    return attestationDetails;

  } catch (error) {
    console.error('Download error details:', error);
    createAlert("Download Error", `Failed to download attestation data: ${error.message}`);
    setLoading(false);
    setIsDownloadingAttestation(false);
    throw error;
  }
};

/**
 * Checks if this is exactly the attestation provision case
 * @param {Object} challenge - The challenge object from login consent request
 * @returns {boolean} True if this is an attestation provision request
 */
export const checkIfAttestationProvision = (challenge) => {
  return (
    challenge.requested_access &&
    challenge.requested_access.length === 1 &&
    challenge.requested_access[0].vdxfkey === primitives.IDENTITY_VIEW.vdxfid &&
    challenge.redirect_uris &&
    challenge.redirect_uris.length === 1 &&
    challenge.redirect_uris[0].vdxfkey === primitives.ATTESTATION_PROVISION_URL.vdxfid &&
    challenge.provisioning_info &&
    challenge.provisioning_info.length > 0
  );
};

/**
 * Validates if the downloaded data contains valid attestations
 * @param {Object} attestationData - The parsed attestation data
 * @returns {boolean} True if valid, false otherwise
 */
export const validateAttestationData = (attestationData) => {
  if (!attestationData) {
    return false;
  }

  // Check if it's in the new AttestationDetails format
  if (attestationData.version !== undefined && attestationData.attestations && Array.isArray(attestationData.attestations)) {
    return attestationData.attestations.length > 0;
  }

  // Check if it's raw buffer/hex data that can be parsed
  if (attestationData.data || Buffer.isBuffer(attestationData)) {
    return true;
  }

  return false;
};
