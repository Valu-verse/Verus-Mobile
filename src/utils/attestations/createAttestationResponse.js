/*
 * Helpers for building attestation response buffers from stored attestation hex.
 * Supports full and partial (filtered) data responses.
 */
import { parseStoredAttestationHex, serializeStoredAttestation } from './serializedAttestation';
import { MMRDescriptor } from 'verus-typescript-primitives';
import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";

/**
 * Extract the label from a DataDescriptor JSON object, handling both nested
 * and flat serialization formats.
 *   Nested: objectdata[DataDescriptorKey] → { label, objectdata }
 *   Flat:   { label, objectdata }
 */
const getDescriptorLabel = (descriptorJson) => {
  const descriptorKeyId = VDXF_Data.DataDescriptorKey?.vdxfid;
  const nested = descriptorJson?.objectdata?.[descriptorKeyId];
  return nested?.label || descriptorJson?.label || null;
};

/**
 * Build a binary response buffer from a stored attestation hex string.
 * For PARTIAL_DATA requests, only the descriptors whose labels appear in
 * `requiredKeys` are kept; the rest are dropped.
 *
 * Returns a Buffer containing the serialized MMRDescriptor + SignatureData.
 *
 * @param {string} storedHex  The stored attestation hex (MMRDescriptor + SignatureData)
 * @param {string[]|null} requiredKeys  VDXF label keys to keep (null = keep all)
 * @returns {Buffer}
 */
export const createAttestationResponseBuffer = (storedHex, requiredKeys) => {
  const { mmrDescriptor, signatureData } = parseStoredAttestationHex(storedHex);

  if (!mmrDescriptor || !mmrDescriptor.dataDescriptors) {
    throw new Error('No MMR descriptor or data descriptors found in attestation');
  }

  if (!Array.isArray(requiredKeys) || requiredKeys.length === 0) {
    // FULL_DATA — return the original bytes unchanged
    return Buffer.from(storedHex, 'hex');
  }

  // PARTIAL_DATA — filter descriptors, rebuild, re-serialise
  const filteredDescriptors = mmrDescriptor.dataDescriptors.filter((dd) => {
    try {
      const label = getDescriptorLabel(dd.toJson());
      return label && requiredKeys.includes(label);
    } catch (e) {
      console.warn('Error filtering data descriptor:', e);
      return false;
    }
  });

  // Build a new MMRDescriptor with only the filtered descriptors
  const filteredMmr = new MMRDescriptor({
    version: mmrDescriptor.version,
    objectHashType: mmrDescriptor.objectHashType,
    mmrHashType: mmrDescriptor.mmrHashType,
    mmrRoot: mmrDescriptor.mmrRoot,
    mmrHashes: mmrDescriptor.mmrHashes,
    dataDescriptors: filteredDescriptors,
  });

  return serializeStoredAttestation(filteredMmr, signatureData);
};