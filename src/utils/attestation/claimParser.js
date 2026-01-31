/*
  claimParser.js
  Helper functions for parsing claim objects from attestation data descriptors.
  
  A claim object is serialized as:
  - version (varint)
  - flags (varint)
  - type (20-byte slice, base58check encoded with version 102)
  - data (varslice containing JSON string)
*/

import { toBase58Check } from 'verus-typescript-primitives';

// Known claim types
export const CLAIM_TYPES = {
  CLAIM: {
    vdxfid: "i4d7U1aZhmoxZbWx8AVezh6z1YewAnuw3V",
    name: "Claim"
  },
  CLAIM_EMPLOYMENT: {
    vdxfid: "i3bgiLuaxTr6smF8q6xLG4jvvhF1mmrkM2",
    name: "Employment"
  },
  CLAIM_ACHIEVEMENT: {
    vdxfid: "i51jfK8wZrKa5LgF7pkbow8hV1Hv6nBm2K",
    name: "Achievement"
  },
  CLAIM_CERTIFICATION: {
    vdxfid: "iPkJZJiwZSJrgnmunhQPnkWsyY28tngW2W",
    name: "Certification"
  },
  CLAIM_EDUCATION: {
    vdxfid: "iJ5sikvjEbSkijSxwWQ2J197XVTzunm6kP",
    name: "Education"
  },
  CLAIM_SKILL: {
    vdxfid: "iEpYe4cC73H7i9ay3G8geAjD1tFAhWscvj",
    name: "Skill"
  },
  CLAIM_EXPERIENCE: {
    vdxfid: "iFqtB6XGZmuUKW3Bzongrnum4QAf25Hgfu",
    name: "Experience"
  },
  CLAIM_VALU:{
    vdxfid: "iNnJaKp16jp2ZYgDnCAs1Z3HEc4SaSsXfD",
    name: "Valu Claim"
  }
};

// Build lookup map from vdxfid to claim type info
const CLAIM_TYPE_MAP = {};
Object.values(CLAIM_TYPES).forEach(ct => {
  CLAIM_TYPE_MAP[ct.vdxfid] = ct;
});

/**
 * Simple buffer reader for parsing claim data
 */
class SimpleBufferReader {
  constructor(buffer, offset = 0) {
    this.buffer = buffer;
    this.offset = offset;
  }

  readVarInt() {
    const first = this.buffer.readUInt8(this.offset);
    this.offset += 1;

    if (first < 0xfd) {
      return first;
    } else if (first === 0xfd) {
      const value = this.buffer.readUInt16LE(this.offset);
      this.offset += 2;
      return value;
    } else if (first === 0xfe) {
      const value = this.buffer.readUInt32LE(this.offset);
      this.offset += 4;
      return value;
    } else {
      // 0xff - 8 bytes
      const low = this.buffer.readUInt32LE(this.offset);
      const high = this.buffer.readUInt32LE(this.offset + 4);
      this.offset += 8;
      return high * 0x100000000 + low;
    }
  }

  readSlice(length) {
    const slice = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  readVarSlice() {
    const length = this.readVarInt();
    return this.readSlice(length);
  }
}

/**
 * Attempt to parse data as a claim object.
 * 
 * @param {Buffer|string} data - The objectdata from a data descriptor (hex string or Buffer)
 * @returns {object|null} - Parsed claim object with { type, typeName, version, flags, data } or null if not a valid claim
 */
export function tryGetClaim(data) {
  try {
    if (!data) return null;

    // Convert hex string to buffer if needed
    let buffer;
    if (typeof data === 'string') {
      buffer = Buffer.from(data, 'hex');
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      return null;
    }

    if (buffer.length < 22) {
      // Minimum: 1 byte version + 1 byte flags + 20 bytes type
      return null;
    }

    const reader = new SimpleBufferReader(buffer, 0);

    // Read version
    const version = reader.readVarInt();

    // Read flags
    const flags = reader.readVarInt();

    // Read type as 20-byte slice and convert to base58check
    const typeSlice = reader.readSlice(20);
    const type = toBase58Check(typeSlice, 102);

    // Check if this is a known claim type
    const claimTypeInfo = CLAIM_TYPE_MAP[type];

    if (!claimTypeInfo) {
      return null;
    }

    // Read the data JSON
    const dataSlice = reader.readVarSlice();
    const dataJson = dataSlice.toString('utf-8');
    const claimData = JSON.parse(dataJson);
    console.log('claimData:', claimData, claimTypeInfo.name);
    return {
      type,
      typeName: claimTypeInfo.name,
      version,
      flags,
      data: {"type": claimData.blockAnswers[0].answerMessage}
    };
  } catch (error) {
    // Not a valid claim object
    return null;
  }
}

/**
 * Extract displayable key-value pairs from claim data.
 * Recursively flattens nested objects.
 * 
 * @param {object} claimData - The parsed claim data object
 * @param {string} prefix - Prefix for nested keys
 * @returns {Array<{key: string, value: string}>} - Array of key-value pairs
 */
export function flattenClaimData(claimData, prefix = '') {
  const result = [];

  if (!claimData || typeof claimData !== 'object') {
    return result;
  }

  for (const [key, value] of Object.entries(claimData)) {
    const displayKey = prefix ? `${prefix}.${key}` : key;
    
    if (value === null || value === undefined) {
      continue;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively flatten nested objects
      result.push(...flattenClaimData(value, displayKey));
    } else if (Array.isArray(value)) {
      // Handle arrays - stringify for now
      result.push({ key: displayKey, value: JSON.stringify(value) });
    } else {
      result.push({ key: displayKey, value: String(value) });
    }
  }

  return result;
}

/**
 * Format a claim key for display (convert camelCase/snake_case to Title Case)
 * 
 * @param {string} key - The raw key name
 * @returns {string} - Formatted display name
 */
export function formatClaimKey(key) {
  if (!key) return '';
  
  // Remove any prefix (e.g., "blockAnswers.0.answerMessage" -> "Answer Message")
  const lastPart = key.split('.').pop();
  
  // Convert camelCase to spaces
  let formatted = lastPart.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Convert snake_case to spaces
  formatted = formatted.replace(/_/g, ' ');
  
  // Capitalize first letter of each word
  formatted = formatted.replace(/\b\w/g, c => c.toUpperCase());
  
  return formatted;
}

export default {
  tryGetClaim,
  flattenClaimData,
  formatClaimKey,
  CLAIM_TYPES,
  CLAIM_TYPE_MAP
};
