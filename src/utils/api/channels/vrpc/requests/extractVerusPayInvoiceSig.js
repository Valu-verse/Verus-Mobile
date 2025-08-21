import { primitives } from "verusid-ts-client"
import { getSignatureInfo } from "./getSignatureInfo";

export const extractVerusPayInvoiceSig = (coinObj, inv) => {
  let invoice;

  if (inv instanceof primitives.VerusPayInvoice) {
    invoice = inv;
  } else {
    invoice = primitives.VerusPayInvoice.fromJson(inv);
  }

  return getSignatureInfo(
    coinObj.system_id,
    invoice.signing_id,
    invoice.signature.signature
  );
};