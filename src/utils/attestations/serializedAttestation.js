/*
 * Shared helpers for serializing and parsing stored attestations as
 * concatenated `MMRDescriptor` bytes followed by `SignatureData` bytes.
 */
import { MMRDescriptor, SignatureData } from 'verus-typescript-primitives';

export const serializeStoredAttestation = (mmrDescriptor, signatureData) => {
  if (!mmrDescriptor || typeof mmrDescriptor.toBuffer !== 'function') {
    throw new Error('Invalid MMR descriptor');
  }

  if (!signatureData || typeof signatureData.toBuffer !== 'function') {
    throw new Error('Invalid signature data');
  }

  const mmrBuf = mmrDescriptor.toBuffer();
  const sigBuf = signatureData.toBuffer();
  const combined = Buffer.concat([mmrBuf, sigBuf]);
  return combined;
};

export const parseStoredAttestationBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid attestation buffer');
  }

  const mmrDescriptor = new MMRDescriptor();
  const nextOffset = mmrDescriptor.fromBuffer(buffer, 0);

  const signatureData = new SignatureData();
  const finalOffset = signatureData.fromBuffer(buffer, nextOffset);

  if (finalOffset > buffer.length) {
    throw new Error('Stored attestation parse exceeded buffer length');
  }

  return { mmrDescriptor, signatureData, offset: finalOffset };
};

export const parseStoredAttestationHex = (hex) => {
  if (!hex || typeof hex !== 'string') {
    throw new Error('Invalid attestation hex');
  }

  return parseStoredAttestationBuffer(Buffer.from(hex, 'hex'));
};

export const tryParseStoredAttestationHex = (hex) => {
  try {
    return parseStoredAttestationHex(hex);
  } catch (error) {
    return null;
  }
};
