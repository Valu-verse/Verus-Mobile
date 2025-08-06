import { requestAttestationData } from "../../utils/auth/authBox";
import { ATTESTATIONS_PROVISIONED } from "../../utils/constants/attestations";
import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";
import { VdxfUniValue } from "verus-typescript-primitives";

export const createAttestationResponse = async (attestationIdentifier, requiredKeys, multipleAttestations = false) => {

  const attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);

  if (multipleAttestations) {
    // Handle multiple attestations - return complete AttestationPairs for each
    if (!Array.isArray(attestationIdentifier)) {
      throw new Error('For multiple attestations, attestationIdentifier must be an array of attestation IDs');
    }

    const multipleAttestationResponse = [];

    for (const attestationID of attestationIdentifier) {
      if (!attestationData[attestationID]) {
        console.warn(`Attestation ${attestationID} not found in attestation data, skipping`);
        continue;
      }

      const attestation = { ...attestationData[attestationID] };
      
      // For multiple attestations, keep the complete AttestationPair data
      // No filtering of keys - send the whole attestation
      multipleAttestationResponse.push(attestation);
    }

    return multipleAttestationResponse;

  } else {
    // Handle single attestation - filter specific keys
    if (!attestationData[attestationIdentifier]) {
      throw new Error(`Attestation not found in attestation data`);
    }

    const attestation = attestationData[attestationIdentifier];

    const vdxfObjects = new VdxfUniValue();

    vdxfObjects.fromBuffer(Buffer.from(attestation.data, "hex"));

    attestation.data = {};

    vdxfObjects.toJson().forEach((item) => {
      const key = Object.keys(item)[0];
      const value = Object.values(item)[0];
      attestation.data[key] = value;
    });

    const attestataionKeysToRemove = [];
    const indexedDatadescriptor = {}

    for (let i = 0; i < attestation.data.length; i++) {
      if (Object.keys(attestation.data[i])[0] === VDXF_Data.MMRDescriptorKey.vdxfid) {

        for (let j = 0; j < attestation.data[i][VDXF_Data.MMRDescriptorKey.vdxfid].datadescriptors.length; j++) {

          const item = attestation.data[i][VDXF_Data.MMRDescriptorKey.vdxfid].datadescriptors[j].objectdata[VDXF_Data.DataDescriptorKey.vdxfid];

          if (requiredKeys.indexOf(item.label) === -1) {
            attestataionKeysToRemove.push(j)
          } else {
            indexedDatadescriptor[j] = attestation.data[i][VDXF_Data.MMRDescriptorKey.vdxfid].datadescriptors[j];
          }

        }
        delete attestation.data[i][VDXF_Data.MMRDescriptorKey.vdxfid].datadescriptors
        attestation.data[i][VDXF_Data.MMRDescriptorKey.vdxfid].datadescriptors = indexedDatadescriptor
      }
    };

    return attestation;
  }
}