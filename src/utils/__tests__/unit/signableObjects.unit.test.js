import {
  describeSignableObject,
  extractSignableDescriptors,
  getSignableObjectTitle,
  objectDataToBuffer,
} from '../../deeplink/signableObjects';
import {
  CompactAddressObject,
  DataDescriptor,
  DataPacketRequestDetails,
  DataResponseDetails,
  DataResponseOrdinalVDXFObject,
  DATA_PACKET_REQUEST_VDXF_KEY,
  GenericRequest,
  GenericResponse,
  SignatureData,
  VdxfUniValue,
  VerifiableSignatureData,
} from 'verus-typescript-primitives';
import * as VDXF_Data from 'verus-typescript-primitives/dist/vdxf/vdxfdatakeys';
import { BN } from 'bn.js';
const createHash = require('create-hash');

// Real endorsement request: a GenericRequest carrying a DataPacketRequestDetails
// with FLAG_HAS_URL_FOR_DOWNLOAD | FLAG_FOR_USERS_SIGNATURE (flags 43) whose
// URL resolves to the packet in ENDORSEMENT_PACKET_HEX below.
const ENDORSEMENT_REQUEST_URI =
  'verus://1/AY8BEAIFAQIa9bgBXGTTmrRMYOrYMX-fWptsTAECOh52NDpjoHHScNeHTxbtJqG4tgNJAgXXsj8AAUEgdEpzWrXiTxmNR2wvJUeZ6McWzCNAePnemPoim_JUjxEiQaSRNJqjMYRbMSoNWFKU7ZcOo4cjNRSxeJGSqIDRRAEC5ixa2yK5y0aNP9sI-ehtpxXgLS7-LodsagICARkCAQEBAotF4_4lucoFPesJ2veAelxMeijVCQG8KwEAAQCI1q5awFcbItFhJhuHx0j24K7gM00BcgICAY_ZHWPXgFQLsf8sOZqT42fdKiXoZHFIIwpsNMmB0OT7Tmh0dHBzOi8vdnJzYy1kZXYudGV4cG8uaW8vYXBpL3YzL29iamVjdHMvZGwvaVFUWnoyakxwTWRpVE0yRjNwa0N2RmJDRnNhR1B6WnNOMgEWVmFsdVZlcnNlIEVuZG9yc2VtZW50cwEC5ixa2yK5y0aNP9sI-ehtpxXgLS4BATVodHRwczovL3Zyc2MtZGV2LnRleHBvLmlvL2FwaS92My9lbmRvcnNlbWVudHNSZXNwb25zZQ';

// The serialized DataDescriptor served by the request's download URL. Its
// objectdata is a VdxfUniValue holding three nested endorsement descriptors.
const ENDORSEMENT_PACKET_HEX =
  '0120fdce0308a2ebb2c55f83a8e2a426a53320ed4d42124f4d01fd2c010160f57b2276657273696f6e223a312c22656e646f72736565223a22694e4e627250374e716d7957794d556b41664b716750516739566331365362444541222c226d657373616765223a22477265617420636f6c6c61626f7261746f72222c227265666572656e6365223a2266616338313661623665333134343163623832326530353730646631623261323138383032306365666365623861636562323538366131333831343432303731222c2274786964223a2238306335353039373033616566326631316461386565316135616533353533333736306232646232376635396264393535396231363966636562373564303036227d2269446250687a6d3867376d513934437932564e6e37644a50566b357a634452685053106170706c69636174696f6e2f6a736f6e08a2ebb2c55f83a8e2a426a53320ed4d42124f4d01fd2d010160f67b2276657273696f6e223a312c22656e646f72736565223a22694e4e627250374e716d7957794d556b41664b716750516739566331365362444541222c226d657373616765223a22477265617420636f6c6c61626f7261746f7232222c227265666572656e6365223a2266616338313661623665333134343163623832326530353730646631623261323138383032306365666365623861636562323538366131333831343432303731222c2274786964223a2238306335353039373033616566326631316461386565316135616533353533333736306232646232376635396264393535396231363966636562373564303036227d2269446250687a6d3867376d513934437932564e6e37644a50566b357a634452685053106170706c69636174696f6e2f6a736f6e08a2ebb2c55f83a8e2a426a53320ed4d42124f4d01fd2d010160f67b2276657273696f6e223a312c22656e646f72736565223a22694e4e627250374e716d7957794d556b41664b716750516739566331365362444541222c226d657373616765223a22477265617420636f6c6c61626f7261746f7233222c227265666572656e6365223a2266616338313661623665333134343163623832326530353730646631623261323138383032306365666365623861636562323538366131333831343432303731222c2274786964223a2238306335353039373033616566326631316461386565316135616533353533333736306232646232376635396264393535396231363966636562373564303036227d2269446250687a6d3867376d513934437932564e6e37644a50566b357a634452685053106170706c69636174696f6e2f6a736f6e1656616c75566572736520456e646f7273656d656e7473';

const SYSTEM_ID = 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV';
const SIGNING_ID = 'iNNbrP7NqmyWyMUkAfKqgPQg9Vc16SbDEA';

const getPacketDescriptor = () => {
  const descriptor = new DataDescriptor();
  descriptor.fromBuffer(Buffer.from(ENDORSEMENT_PACKET_HEX, 'hex'));
  return descriptor;
};

const getRequestDetails = () => {
  const request = GenericRequest.fromWalletDeeplinkUri(ENDORSEMENT_REQUEST_URI);
  const detail = request.details.find(
    x => x.getIAddressKey() === DATA_PACKET_REQUEST_VDXF_KEY.vdxfid,
  );
  return detail.data;
};

describe('objectDataToBuffer', () => {
  it('accepts hex strings, Buffers and serialized Buffers', () => {
    const expected = Buffer.from('deadbeef', 'hex');

    expect(objectDataToBuffer('deadbeef')).toEqual(expected);
    expect(objectDataToBuffer(expected)).toEqual(expected);
    expect(objectDataToBuffer({ type: 'Buffer', data: [0xde, 0xad, 0xbe, 0xef] })).toEqual(expected);
  });

  it('returns null for unusable input', () => {
    expect(objectDataToBuffer(null)).toBeNull();
    expect(objectDataToBuffer(undefined)).toBeNull();
    expect(objectDataToBuffer(42)).toBeNull();
  });
});

describe('extractSignableDescriptors', () => {
  it('pulls every nested descriptor out of a downloaded packet', () => {
    const nested = extractSignableDescriptors(getPacketDescriptor());

    expect(nested).toHaveLength(3);
    nested.forEach(descriptor => {
      expect(descriptor).toBeInstanceOf(DataDescriptor);
      expect(descriptor.mimeType).toEqual('application/json');
    });
  });

  it('returns an empty array when the descriptor holds a single blob', () => {
    const plain = DataDescriptor.fromJson({
      version: 1,
      flags: 64,
      mimetype: 'text/plain',
      objectdata: Buffer.from('not a univalue', 'utf-8').toString('hex'),
    });

    expect(extractSignableDescriptors(plain)).toEqual([]);
    expect(extractSignableDescriptors(new DataDescriptor())).toEqual([]);
  });
});

describe('describeSignableObject', () => {
  it('parses the JSON payload and hashes the exact bytes to be signed', () => {
    const objects = extractSignableDescriptors(getPacketDescriptor()).map(describeSignableObject);

    expect(objects.map(object => object.json.message)).toEqual([
      'Great collaborator',
      'Great collaborator2',
      'Great collaborator3',
    ]);

    objects.forEach((object, index) => {
      expect(object.index).toEqual(index);
      expect(object.json.endorsee).toEqual(SIGNING_ID);
      expect(object.hash).toEqual(
        createHash('sha256').update(object.descriptor.toBuffer()).digest('hex'),
      );
    });

    // Distinct payloads must not collapse to the same signature subject.
    expect(new Set(objects.map(object => object.hash)).size).toEqual(3);
  });

  it('orders fields for display and keeps unknown keys', () => {
    const descriptor = DataDescriptor.fromJson({
      version: 1,
      flags: 64,
      mimetype: 'application/json',
      objectdata: Buffer.from(
        JSON.stringify({ version: 1, txid: 'ab', message: 'hi', extra: 'kept' }),
        'utf-8',
      ).toString('hex'),
    });

    const object = describeSignableObject(descriptor, 0);

    expect(object.fields.map(field => field.key)).toEqual(['message', 'txid', 'extra']);
    expect(object.fields[0].label).toEqual('Message');
    expect(object.fields[2].label).toEqual('Extra');
  });

  it('falls back to text for non-JSON payloads', () => {
    const descriptor = DataDescriptor.fromJson({
      version: 1,
      flags: 64,
      mimetype: 'text/plain',
      objectdata: Buffer.from('I agree to the terms', 'utf-8').toString('hex'),
    });

    const object = describeSignableObject(descriptor, 2);

    expect(object.json).toBeNull();
    expect(object.text).toEqual('I agree to the terms');
    expect(object.fields).toEqual([]);
    expect(getSignableObjectTitle(object)).toEqual('I agree to the terms');
  });
});

describe('getSignableObjectTitle', () => {
  it('prefers a resolved label, then the message, then a positional fallback', () => {
    const [object] = extractSignableDescriptors(getPacketDescriptor()).map(describeSignableObject);

    expect(getSignableObjectTitle(object, 'Endorsement')).toEqual('Endorsement');
    expect(getSignableObjectTitle(object)).toEqual('Great collaborator');

    const empty = describeSignableObject(new DataDescriptor(), 4);
    expect(getSignableObjectTitle(empty)).toEqual('Object 5');
  });
});

describe('multi signature response', () => {
  // Mirrors signAndCreateResponse in DataPacketRequestInfo: one SignatureData
  // per selected object, emitted next to the bytes it covers.
  const buildResponse = (objects, details) => {
    const values = [];

    for (const object of objects) {
      const sigData = new SignatureData({
        version: new BN(1),
        systemID: SYSTEM_ID,
        identityID: SIGNING_ID,
        signatureHash: createHash('sha256').update(object.buffer).digest(),
        hashType: new BN(5),
        sigType: new BN(1),
      });
      // Stand-in for the signHash RPC result.
      sigData.signatureAsVch = Buffer.alloc(65, object.index + 1);

      values.push({ [VDXF_Data.DataDescriptorKey.vdxfid]: object.descriptor });
      values.push({ [VDXF_Data.SignatureDataKey.vdxfid]: sigData });
    }

    const responseDetails = new DataResponseDetails({
      data: DataDescriptor.fromJson({
        version: 1,
        flags: 2,
        objectdata: new VdxfUniValue({ values }).toBuffer().toString('hex'),
        salt: Buffer.alloc(32, 9).toString('hex'),
      }),
      requestID: details.requestID,
    });

    const response = new GenericResponse();
    response.details = [new DataResponseOrdinalVDXFObject({ data: responseDetails })];
    response.requestID = details.requestID;
    response.signature = new VerifiableSignatureData({
      systemID: CompactAddressObject.fromIAddress(SYSTEM_ID),
      identityID: CompactAddressObject.fromIAddress(SIGNING_ID),
    });
    response.signature.signatureAsVch = Buffer.alloc(65, 1);
    response.setSigned();
    response.setFlags();

    return response;
  };

  const readSignedPairs = (response) => {
    const uniValue = new VdxfUniValue();
    uniValue.fromBuffer(response.details[0].data.data.objectdata);

    const pairs = [];
    let pendingDescriptor = null;

    for (const value of uniValue.values) {
      const descriptor = value[VDXF_Data.DataDescriptorKey.vdxfid];
      if (descriptor) pendingDescriptor = descriptor;

      const signature = value[VDXF_Data.SignatureDataKey.vdxfid];
      if (signature && pendingDescriptor) {
        pairs.push({ descriptor: pendingDescriptor, signature });
        pendingDescriptor = null;
      }
    }

    return pairs;
  };

  it('confirms the request asks for the user signature over downloaded data', () => {
    const details = getRequestDetails();

    expect(
      details.flags.and(DataPacketRequestDetails.FLAG_FOR_USERS_SIGNATURE).gt(new BN(0)),
    ).toBe(true);
    expect(
      details.flags.and(DataPacketRequestDetails.FLAG_HAS_URL_FOR_DOWNLOAD).gt(new BN(0)),
    ).toBe(true);
    expect(details.statements).toEqual(['ValuVerse Endorsements']);
  });

  it('carries one signature per object and survives a serialization roundtrip', () => {
    const details = getRequestDetails();
    const objects = extractSignableDescriptors(getPacketDescriptor()).map(describeSignableObject);

    const buffer = buildResponse(objects, details).toBuffer();

    const restored = new GenericResponse();
    restored.fromBuffer(buffer);
    expect(restored.toBuffer().toString('hex')).toEqual(buffer.toString('hex'));

    const pairs = readSignedPairs(restored);
    expect(pairs).toHaveLength(3);

    // Each signature must cover the descriptor it is paired with.
    pairs.forEach((pair, index) => {
      expect(pair.signature.signatureHash.toString('hex')).toEqual(objects[index].hash);
      expect(
        createHash('sha256').update(pair.descriptor.toBuffer()).digest('hex'),
      ).toEqual(objects[index].hash);
      expect(pair.signature.identityID).toEqual(SIGNING_ID);
    });

    expect(restored.requestID.toIAddress()).toEqual(details.requestID.toIAddress());
  });

  it('only signs the objects the user selected', () => {
    const details = getRequestDetails();
    const objects = extractSignableDescriptors(getPacketDescriptor()).map(describeSignableObject);
    const selected = objects.filter(object => [0, 2].includes(object.index));

    const pairs = readSignedPairs(buildResponse(selected, details));

    expect(pairs).toHaveLength(2);
    expect(pairs.map(pair => pair.signature.signatureHash.toString('hex'))).toEqual([
      objects[0].hash,
      objects[2].hash,
    ]);
  });
});