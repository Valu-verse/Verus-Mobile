import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";
const { AttestationPair } = require("verus-typescript-primitives/dist/vdxf/classes/attestation/AttestationDetails");

export const createAttestationResponse = async (selectionOrSelections, requiredKeys, multipleAttestations = false) => {
  if (multipleAttestations) {
    // Expect an array of selected attestation objects with a `raw` property
    if (!Array.isArray(selectionOrSelections)) {
      throw new Error('For multiple attestations, pass an array of selected attestations');
    }

    const multipleAttestationResponse = [];

    for (const sel of selectionOrSelections) {
      const raw = sel && sel.raw ? sel.raw : null;
      if (!raw) {
        console.warn(`Selection missing raw attestation data, skipping`);
        continue;
      }
      // Keep the complete stored attestation object as-is
      multipleAttestationResponse.push({ ...raw });
    }

    return multipleAttestationResponse;
  } else {
    // Single attestation: expect a single selection object with `raw`
    const sel = selectionOrSelections;
    const raw = sel && sel.raw ? sel.raw : null;
    if (!raw) throw new Error('Selected attestation is missing raw data');

    const attestation = { ...raw };

    // Parse AttestationPair and convert to JSON immediately
    let attestationDetailsJson;
    try {
      const attestationDetails = new AttestationPair();
      attestationDetails.fromBuffer(Buffer.from(attestation.data, 'hex'));
      attestationDetailsJson = attestationDetails.toJson();

    } catch (e) {
      console.error("Failed to parse AttestationPair:", e);
      throw new Error('Failed to parse attestation data');
    }

    const mmrDescriptor = attestationDetailsJson?.mmrdescriptor;
    if (!mmrDescriptor || !mmrDescriptor.datadescriptors) {
      throw new Error('No MMR descriptor or data descriptors found in attestation');
    }

    // Filter dataDescriptors by requiredKeys if provided
    let filteredDataDescriptors = mmrDescriptor.datadescriptors;
    
    if (Array.isArray(requiredKeys) && requiredKeys.length > 0) {
      filteredDataDescriptors = mmrDescriptor.datadescriptors.filter((dataDescriptor) => {
        try {
          const dd = dataDescriptor?.objectdata?.[VDXF_Data.DataDescriptorKey.vdxfid];
          const label = dd?.label;
          return label && requiredKeys.indexOf(label) !== -1;
        } catch (e) {
          console.warn("Error processing dataDescriptor:", e);
          return false;
        }
      });

    }

    // Create filtered attestation JSON with only the filtered descriptors
    const filteredAttestationJson = {
      ...attestationDetailsJson,
      mmrdescriptor: {
        ...mmrDescriptor,
        datadescriptors: filteredDataDescriptors
      }
    };

    // Return as JSON
    attestation.data = filteredAttestationJson;

    return attestation;
  }
}