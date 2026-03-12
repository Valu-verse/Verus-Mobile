import BigNumber from "bignumber.js";
import { BN } from 'bn.js';
import varint from 'verus-typescript-primitives/dist/utils/varint';
import varuint from 'verus-typescript-primitives/dist/utils/varuint';
import bufferutils from 'verus-typescript-primitives/dist/utils/bufferutils';
const { BufferReader, BufferWriter } = bufferutils;

import { SerializableEntity } from 'verus-typescript-primitives/dist/utils/types/SerializableEntity';


export const RequestedFormatFlags = {
  FULL_DATA: 1,    // Whole Credential
  PARTIAL_DATA: 2, // Particular leaf + proof + signature
  COLLECTION: 4    // Multiple FULL_DATA only
};

export const InformationType = {
  ATTESTATION: 1,
  CLAIM: 2,
  CREDENTIAL: 3,
  ENDORSEMENT: 4,
  TICKET: 5
};


export class RequestItem {

  static VERSION_INVALID = new BN(0);
  static FIRST_VERSION = new BN(1);
  static LAST_VERSION = new BN(1);
  static DEFAULT_VERSION = new BN(1);
  
  static FULL_DATA = new BN(1);
  static PARTIAL_DATA = new BN(2);
  static COLLECTION = new BN(4);

  static ATTESTATION = new BN(1);
  static CLAIM = new BN(2);
  static CREDENTIAL = new BN(3);

  version;
  format;
  type;
  id;
  signer;
  requestedkeys;

  constructor(json) {
    this.version = json?.version || RequestItem.DEFAULT_VERSION;
    this.format = json?.format || RequestItem.FULL_DATA;
    this.type = json?.type || RequestItem.ATTESTATION;
    this.id = json?.id || {};
    this.signer = json?.signer || '';
    this.requestedkeys = json?.requestedkeys || [];
  }

  isFormatValid() {
    // Allowed values: 1 (FULL), 2 (PARTIAL), 5 (FULL|COLLECTION), 6 (PARTIAL|COLLECTION)
    const f = this.format;
    return (
      f.eq(RequestItem.FULL_DATA) ||
      f.eq(RequestItem.PARTIAL_DATA) ||
      f.eq(RequestItem.FULL_DATA.or(RequestItem.COLLECTION)) ||
      f.eq(RequestItem.PARTIAL_DATA.or(RequestItem.COLLECTION))
    );
  }

  isValid(){
    let valid = this.version.gte(RequestInformation.FIRST_VERSION) && this.version.lte(RequestInformation.LAST_VERSION);
    valid &&= this.isFormatValid();
    valid &&= (this.type.gte(RequestItem.ATTESTATION) && this.type.lte(RequestItem.CREDENTIAL));
    return valid;
  }

  getByteLength(){
    let length = 0;
    length += varint.encodingLength(this.version);
    length += varint.encodingLength(this.format);
    length += varint.encodingLength(this.type);
    
    // Serialize id object as JSON string
    const idJson = JSON.stringify(this.id);
    length += varuint.encodingLength(Buffer.byteLength(idJson, 'utf8'));
    length += Buffer.byteLength(idJson, 'utf8');
    
    // Add signer length
    length += varuint.encodingLength(Buffer.byteLength(this.signer, 'utf8'));
    length += Buffer.byteLength(this.signer, 'utf8');
    
    length += varuint.encodingLength(this.requestedkeys ? this.requestedkeys.length : 0);
    if (this.requestedkeys) {
      for (const key of this.requestedkeys) {    
        length += varuint.encodingLength(Buffer.byteLength(key, 'utf8'));    
        length += Buffer.byteLength(key, 'utf8');
      }
    }
    return length;
  }

  toBuffer(){
    const writer = new BufferWriter(Buffer.alloc(this.getByteLength()));
    writer.writeVarInt(this.version);
    writer.writeVarInt(this.format);
    writer.writeVarInt(this.type);
    
    // Serialize id object as JSON string
    const idJson = JSON.stringify(this.id);
    writer.writeVarSlice(Buffer.from(idJson, 'utf8'));
    
    // Write signer
    writer.writeVarSlice(Buffer.from(this.signer, 'utf8'));
    
    writer.writeCompactSize(this.requestedkeys ? this.requestedkeys.length : 0);
    if (this.requestedkeys) {
      for (const key of this.requestedkeys) {
        writer.writeVarSlice(Buffer.from(key, 'utf8'));
      }
    }
    return writer.buffer;
  }

  fromBuffer(buffer, offset){
    const reader = new BufferReader(buffer, offset);
    this.version = reader.readVarInt();
    this.format = reader.readVarInt();
    this.type = reader.readVarInt();
    
    // Deserialize id object from JSON string
    const idJsonString = reader.readVarSlice().toString('utf8');
    this.id = JSON.parse(idJsonString);
    
    // Read signer
    this.signer = reader.readVarSlice().toString('utf8');
    
    this.requestedkeys = [];
    const requestedKeysLength = reader.readCompactSize();
    for (let i = 0; i < requestedKeysLength; i++) {
      this.requestedkeys.push(reader.readVarSlice().toString('utf8'));
    }
    return reader.offset;
  }

  toJSON() {
    return {
      version: this.version.toNumber(),
      format: this.format.toNumber(),
      type: this.type.toNumber(),
      id: this.id,
      signer: this.signer,
      requestedkeys: this.requestedkeys
    };
  }

  fromJSON(json){
    this.version = new BN(json.version);
    this.format = new BN(json.format);
    this.type = new BN(json.type);
    this.id = json.id;
    this.signer = json.signer;
    this.requestedkeys = json.requestedkeys || [];
  }
}

export class RequestInformation  {
  static VERSION_INVALID = new BN(0);
  static FIRST_VERSION = new BN(1);
  static LAST_VERSION = new BN(1);
  static DEFAULT_VERSION = new BN(1);
  
  version;
  items;
  
  constructor(data) {
    this.version = data?.version ? new BN(data.version) : RequestInformation.DEFAULT_VERSION;
    this.items = data?.items || [];
  }

  isValid() {
    let valid = this.version.gte(RequestInformation.FIRST_VERSION) && this.version.lte(RequestInformation.LAST_VERSION);
    valid &&= this.items.every(item => {
      return item.isValid();
    });
    return valid;
  }

  getByteLength(){
    let length = 0;
    length += varint.encodingLength(this.version);
    length += varuint.encodingLength(this.items.length);
    for (const item of this.items) {
      length += item.getByteLength();
    }
    return length;
  }

  toBuffer(){
    const writer = new BufferWriter(Buffer.alloc(this.getByteLength()));
    writer.writeVarInt(this.version);
    writer.writeCompactSize(this.items ? this.items.length : 0);
    if (this.items) {
      for (const item of this.items) {
        const itemBuffer = item.toBuffer();
        writer.writeSlice(itemBuffer);
      }
    }
    return writer.buffer;
  }

  fromBuffer(buffer, offset){
    const reader = new BufferReader(buffer, offset);
    this.version = reader.readVarInt();
    this.items = [];
    const itemsLength = reader.readCompactSize();
    for (let i = 0; i < itemsLength; i++) {
      const item = new RequestItem();
      reader.offset = item.fromBuffer(buffer, reader.offset);
      this.items.push(item);
    }
    return reader.offset;
  }

  toJSON() {
    return {
      version: this.version.toNumber(),
      items: this.items.map(item => item.toJSON())
    };
  }

  fromJSON(json) {
    this.version = new BN(json.version);
    this.items = json.items.map(itemJson => {
      const item = new RequestItem();
      item.fromJSON(itemJson);
      return item;
    });
  }
}