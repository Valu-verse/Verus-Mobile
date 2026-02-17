/**
 * Utility functions for processing and displaying DataDescriptor objects.
 * Provides a universal handler for DataDescriptor display across the app.
 */

import { IdentityVdxfidMap } from 'verus-typescript-primitives/dist/utils/IdentityData';

// VDXF keys for attestation-related labels
const ATTESTATION_NAME_VDXFID = 'i4GC1YGEVD21afWudGoFJVdnfjJ8bfCoct';

// Custom VDXF label map for labels not in IdentityVdxfidMap
const CustomVdxfLabelMap = {
  'i4d7U1aZhmoxZbWx8AVezh6z1YewAnuw3V': 'Valu Claim',
  'iAkd3VBhYQ3MK6PUCtfhXrLVNbqSghxxpn': 'Attestation Recipient',
  'i6htkAtLSyUFr1YBFD13U9TSgPgQe2yDQZ': 'Claim ID',
  'receiving_identity': 'Receiving Identity',
};

/**
 * Get a friendly display name for a VDXF label
 * @param {string} label - The VDXF label/id
 * @returns {string} - Human readable label
 */
export const getFriendlyLabel = (label) => {
  if (!label) return 'Unknown';
  
  if (label === ATTESTATION_NAME_VDXFID) {
    return 'Attestation Name';
  }
  
  return IdentityVdxfidMap[label]?.EN || CustomVdxfLabelMap[label] || label;
};

/**
 * Determine the content type from a DataDescriptor
 * @param {object} descriptor - DataDescriptor JSON object
 * @returns {'text' | 'image' | 'encrypted' | 'unknown'}
 */
export const getDescriptorContentType = (descriptor) => {
  if (!descriptor) return 'unknown';
  
  const mimeType = descriptor.mimetype || '';
  const flags = descriptor.flags || 0;
  
  // Check if encrypted
  if (flags & 1) { // FLAG_ENCRYPTED_DATA = 1
    return 'encrypted';
  }
  
  if (mimeType.startsWith('text/')) {
    return 'text';
  }
  
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  
  // Default to text if no mime type but has objectdata with message
  if (descriptor.objectdata && typeof descriptor.objectdata === 'object' && descriptor.objectdata.message) {
    return 'text';
  }
  
  return 'unknown';
};

/**
 * Extract displayable content from a DataDescriptor
 * @param {object} descriptor - DataDescriptor JSON object
 * @returns {{
 *   label: string,
 *   title: string,
 *   content: string | null,
 *   contentType: 'text' | 'image' | 'encrypted' | 'unknown',
 *   imageUri: string | null,
 *   mimeType: string | null,
 *   isEncrypted: boolean,
 *   raw: object
 * }}
 */
export const processDataDescriptor = (descriptor) => {
  if (!descriptor) {
    return {
      label: '',
      title: 'Unknown',
      content: null,
      contentType: 'unknown',
      imageUri: null,
      mimeType: null,
      isEncrypted: false,
      raw: descriptor,
    };
  }

  const label = descriptor.label || '';
  const title = getFriendlyLabel(label);
  const mimeType = descriptor.mimetype || null;
  const flags = descriptor.flags || 0;
  const isEncrypted = !!(flags & 1); // FLAG_ENCRYPTED_DATA = 1
  const contentType = getDescriptorContentType(descriptor);
  
  let content = null;
  let imageUri = null;
  
  const objectdata = descriptor.objectdata;
  
  if (isEncrypted) {
    content = '[Encrypted data]';
  } else if (contentType === 'text') {
    if (objectdata && typeof objectdata === 'object' && objectdata.message) {
      content = objectdata.message;
    } else if (typeof objectdata === 'string') {
      content = objectdata;
    }
  } else if (contentType === 'image') {
    if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
      try {
        if (typeof objectdata === 'string') {
          // Convert hex string to base64
          imageUri = `data:${mimeType};base64,${Buffer.from(objectdata, 'hex').toString('base64')}`;
        }
        content = '[Image]';
      } catch (e) {
        content = '[Image data error]';
      }
    } else {
      content = `[${mimeType || 'Image'}]`;
    }
  } else {
    // Unknown type - try to extract a readable message
    if (objectdata && typeof objectdata === 'object' && objectdata.message) {
      content = objectdata.message;
    } else if (typeof objectdata === 'string' && objectdata.length < 100) {
      content = objectdata;
    } else {
      content = '[Data]';
    }
  }
  
  return {
    label,
    title,
    content,
    contentType,
    imageUri,
    mimeType,
    isEncrypted,
    raw: descriptor,
  };
};

/**
 * Process multiple DataDescriptors into displayable items
 * Handles both raw DataDescriptor objects and JSON representations
 * @param {Array} descriptors - Array of DataDescriptor objects or JSON
 * @returns {Array<{
 *   key: string,
 *   label: string,
 *   title: string,
 *   content: string | null,
 *   contentType: 'text' | 'image' | 'encrypted' | 'unknown',
 *   imageUri: string | null,
 *   mimeType: string | null,
 *   isEncrypted: boolean,
 *   raw: object
 * }>}
 */
export const processDataDescriptors = (descriptors) => {
  if (!descriptors || !Array.isArray(descriptors)) {
    return [];
  }
  
  return descriptors.map((descriptor, index) => {
    // Handle different input formats
    let descriptorJson = descriptor;
    
    // If it's a DataDescriptor object with toJson method
    if (descriptor && typeof descriptor.toJson === 'function') {
      descriptorJson = descriptor.toJson();
    }
    
    const processed = processDataDescriptor(descriptorJson);
    
    return {
      key: `descriptor-${index}-${processed.label || index}`,
      ...processed,
    };
  });
};

/**
 * Create a compact summary of DataDescriptor content for list display
 * @param {object} processedDescriptor - Result from processDataDescriptor
 * @returns {{
 *   title: string,
 *   subtitle: string,
 *   icon: string,
 *   hasImage: boolean,
 *   imageUri: string | null
 * }}
 */
export const getDescriptorDisplayInfo = (processedDescriptor) => {
  const { title, content, contentType, isEncrypted, imageUri, mimeType } = processedDescriptor;
  
  let icon = 'file-document-outline';
  let subtitle = content || '';
  
  if (isEncrypted) {
    icon = 'lock-outline';
    subtitle = 'Encrypted data';
  } else if (contentType === 'image') {
    icon = 'image-outline';
    subtitle = mimeType || 'Image';
  } else if (contentType === 'text') {
    icon = 'text';
    // Truncate long text for subtitle
    if (subtitle.length > 80) {
      subtitle = subtitle.substring(0, 77) + '...';
    }
  }
  
  return {
    title,
    subtitle,
    icon,
    hasImage: !!imageUri,
    imageUri,
  };
};

export default {
  processDataDescriptor,
  processDataDescriptors,
  getDescriptorDisplayInfo,
  getFriendlyLabel,
  getDescriptorContentType,
};
