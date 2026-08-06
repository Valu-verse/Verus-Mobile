/**
 * Helpers for the signable objects carried by a downloaded data packet.
 *
 * When a DataPacketRequestDetails sets FLAG_HAS_URL_FOR_DOWNLOAD the URL does
 * not have to resolve to a single blob. It can resolve to a DataDescriptor
 * whose objectdata is a VdxfUniValue holding one nested DataDescriptor per
 * object the user is being asked to sign - for example a batch of
 * endorsements. Each nested descriptor is a self contained object that gets
 * its own signature, which is what lets one request produce several
 * signatures.
 */
import { DataDescriptor, VdxfUniValue } from 'verus-typescript-primitives';
import * as VDXF_Data from 'verus-typescript-primitives/dist/vdxf/vdxfdatakeys';
import { capitalizeString } from '../stringUtils';
const createHash = require('create-hash');

// Field order and labels used when a signable object is JSON. Endorsements are
// the first consumer of this flow; anything else falls back to the raw key.
const JSON_FIELD_LABELS = {
  endorsee: 'Endorsee',
  endorser: 'Endorser',
  message: 'Message',
  reference: 'Reference',
  txid: 'Transaction ID',
  version: 'Version',
};

const JSON_FIELD_ORDER = ['message', 'endorsee', 'endorser', 'reference', 'txid'];

/**
 * Coerces the many shapes objectdata arrives in (hex string, Buffer, or the
 * JSON serialised form of a Buffer) into a Buffer.
 * @param {string | Buffer | { type: string, data: Array<number> }} objectdata
 * @returns {Buffer | null}
 */
export const objectDataToBuffer = (objectdata) => {
  if (objectdata == null) return null;
  if (Buffer.isBuffer(objectdata)) return objectdata;
  if (typeof objectdata === 'string') return Buffer.from(objectdata, 'hex');
  if (objectdata.type === 'Buffer' && Array.isArray(objectdata.data)) {
    return Buffer.from(objectdata.data);
  }
  return null;
};

/**
 * Pulls the nested DataDescriptors out of a downloaded packet descriptor.
 * Returns an empty array when the descriptor is not a multi object packet, so
 * callers can fall through to their single blob handling.
 * @param {DataDescriptor} descriptor
 * @returns {Array<DataDescriptor>}
 */
export const extractSignableDescriptors = (descriptor) => {
  const dataBuffer = objectDataToBuffer(descriptor?.objectdata);

  if (!dataBuffer || dataBuffer.length === 0) return [];

  try {
    const uniValue = new VdxfUniValue();
    uniValue.fromBuffer(dataBuffer);

    if (!uniValue.values || uniValue.values.length === 0) return [];

    const descriptorKey = VDXF_Data.DataDescriptorKey.vdxfid;
    const nested = [];

    for (const valueItem of uniValue.values) {
      if (!valueItem || typeof valueItem !== 'object') continue;

      const value = valueItem[descriptorKey];
      if (value instanceof DataDescriptor) nested.push(value);
    }

    return nested;
  } catch (e) {
    // Not a VdxfUniValue - the caller handles the packet as a single object.
    return [];
  }
};

/**
 * Builds the display and signing payload for one signable object.
 *
 * `buffer` is the exact serialisation of the nested descriptor and is what
 * gets hashed and signed, so the requester can verify a signature against the
 * bytes it published.
 * @param {DataDescriptor} descriptor
 * @param {number} index
 */
export const describeSignableObject = (descriptor, index) => {
  const buffer = descriptor.toBuffer();
  const mimeType = descriptor.mimeType || '';
  const contentBuffer = objectDataToBuffer(descriptor.objectdata);

  let json = null;
  let text = null;

  if (contentBuffer) {
    if (mimeType === 'application/json') {
      try {
        json = JSON.parse(contentBuffer.toString('utf-8'));
      } catch (e) {
        text = contentBuffer.toString('utf-8');
      }
    } else if (mimeType.startsWith('text/')) {
      text = contentBuffer.toString('utf-8');
    }
  }

  return {
    index,
    descriptor,
    buffer,
    mimeType,
    label: descriptor.label || '',
    json,
    text,
    fields: json ? buildJsonFields(json) : [],
    hash: createHash('sha256').update(buffer).digest('hex'),
  };
};

/**
 * Flattens a JSON signable object into ordered rows for display. Known keys
 * come first in a readable order, then anything else the sender included.
 * @param {object} json
 * @returns {Array<{ key: string, label: string, value: string }>}
 */
const buildJsonFields = (json) => {
  const keys = Object.keys(json);
  const ordered = [
    ...JSON_FIELD_ORDER.filter(key => keys.includes(key)),
    ...keys.filter(key => !JSON_FIELD_ORDER.includes(key) && key !== 'version'),
  ];

  return ordered.map(key => ({
    key,
    label: JSON_FIELD_LABELS[key] || capitalizeString(key),
    value: typeof json[key] === 'object' ? JSON.stringify(json[key]) : String(json[key]),
  }));
};

/**
 * Short one line summary for a signable object, used as the row title.
 * @param {ReturnType<typeof describeSignableObject>} object
 * @param {string} [labelOverride] friendly name resolved from the signer's defined keys
 */
export const getSignableObjectTitle = (object, labelOverride) => {
  if (labelOverride) return labelOverride;
  if (object.json?.message) return object.json.message;
  if (object.text) return object.text.slice(0, 80);
  return `Object ${object.index + 1}`;
};