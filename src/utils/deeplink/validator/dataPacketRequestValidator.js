import { DataPacketRequestOrdinalVDXFObject, GenericRequest } from "verus-typescript-primitives/dist/vdxf/classes";

/**
 * @param {GenericRequest} request 
 * @param {number} detailIndex
 */
export const validateDataPacketRequestVDXFObject = (request, detailIndex) => {
  const detailsObject = request.getDetails(detailIndex);

  if (!(detailsObject instanceof DataPacketRequestOrdinalVDXFObject)) {
    throw new Error("Data packet request details not found at specified index");
  }

  if (detailsObject.data == null || !detailsObject.data.isValid()) {
    throw new Error("Invalid data packet request details.");
  }
}
