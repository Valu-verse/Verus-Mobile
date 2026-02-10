import { UserDataRequestOrdinalVDXFObject, GenericRequest } from "verus-typescript-primitives/dist/vdxf/classes";

/**
 * @param {GenericRequest} request 
 * @param {number} detailIndex
 */
export const validateUserDataRequestVDXFObject = (request, detailIndex) => {
  const detailsObject = request.getDetails(detailIndex);

  if (!(detailsObject instanceof UserDataRequestOrdinalVDXFObject)) {
    throw new Error("User data request details not found at specified index");
  }

  if (detailsObject.data == null || !detailsObject.data.isValid()) {
    throw new Error("Invalid user data request details.");
  }
}
