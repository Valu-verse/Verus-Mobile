import { primitives } from "verusid-ts-client";
import { VdxfUniValue, MMRDescriptorKey, VectorUint256Key } from "verus-typescript-primitives";
import buff from 'verus-typescript-primitives/dist/utils/bufferutils';
import * as crypto from 'crypto';

export const validateMMRfromMmrDatadescriptor = (mmrData) => {

  const mmrDescriptor = mmrData;

  const hashes = new primitives.VDXFData;
  hashes.fromBuffer(mmrDescriptor.mmrHashes.objectdata);

  let hashArray = [];
  
  // Check if the hashes are of the correct type
  if (hashes.vdxfkey == VectorUint256Key.vdxfid) {

    const reader = new buff.BufferReader(hashes.data, 0);
    const hashCount = reader.readCompactSize();

    //
    for (let i = 0; i < hashCount; i++) {
      const hashslice = reader.readSlice(32);
      hashArray.push(hashslice);
    }
  } else {
    throw new Error("Invalid MMR descriptor");
  }

  // now hash the datadescriptors to check they match the mmr hashes
  for (let i = 0; i < hashArray.length; i++) {

    const innerDataDescriptor = mmrDescriptor.dataDescriptors[i].objectdata;
    const saltedData = new primitives.SaltedData(innerDataDescriptor, mmrDescriptor.dataDescriptors[i].salt);
    const sha256 = crypto.createHash("sha256");

    const sha256Hash = (input) => {
      return sha256.update(input).digest();
    }

    const saltedDataHashed = saltedData.getHash(sha256Hash);
    
    if (saltedDataHashed.toString('hex') !== hashArray[i].toString('hex')) {
      throw new Error("MMR hash mismatch at index " + i);
    }
  }

  const mmr = new primitives.MerkleMountainRange();

  // build the MMR from the hashes
  // each hash is a leaf node in the MMR
  for (let i = 0; i < hashArray.length; i++) {
    const hash = hashArray[i];
    if (hash.length !== 32) {
      throw new Error("Invalid hash length in MMR");
    }
    const newNode = new primitives.MMRNode(hash);
    mmr.add(newNode);
  }

  const mmv = new primitives.MerkleMountainView(mmr);
  // get the root of the MMR
  const mmrRoot = mmv.getRoot();

  return (mmrRoot.toString('hex') == mmrDescriptor.mmrRoot.objectdata.toString('hex'));

}