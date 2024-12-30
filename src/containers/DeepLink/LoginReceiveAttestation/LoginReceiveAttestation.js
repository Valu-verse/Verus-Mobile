import { Component } from "react"
import { connect } from 'react-redux'
import { createAlert, resolveAlert } from "../../../actions/actions/alert/dispatchers/alert"
import { LoginReceiveAttestationRender } from "./LoginReceiveAttestation.render"
import { primitives } from "verusid-ts-client"
import { VdxfUniValue } from "verus-typescript-primitives/dist/pbaas/VdxfUniValue";
import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";
import { SignatureData } from "verus-typescript-primitives/dist/pbaas/SignatureData";
import { verifyHash } from "../../../utils/api/channels/vrpc/requests/verifyHash";
import { getSignatureInfo } from "../../../utils/api/channels/vrpc/requests/getSignatureInfo";
const { ATTESTATION_NAME } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { ATTESTATIONS_PROVISIONED } from "../../../utils/constants/attestations";
import { modifyAttestationDataForUser } from "../../../actions/actions/attestations/dispatchers/attestations";

class LoginReceiveAttestation extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loginConsent: null,
      loading: false,
      ready: false,
      personalDataURL: "",
      signerFqn: this.props.route.params.signerFqn,
      attestationName: "",
      attestationData: {},
      completeAttestaton: {},
    };
  }

  componentDidMount() {
    this.updateDisplay();
  }

  cancel = () => {
    if (this.props.route.params.cancel) {
      this.props.route.params.cancel.cancel()
    }
  }

  validateAttestation = async (signatureData, mmrData) => {

    const sigInfo = await getSignatureInfo(
      signatureData.system_ID,
      signatureData.identity_ID,
      signatureData.signature_as_vch.toString('base64'),
    );

    const hashVerified = await verifyHash(signatureData.system_ID, signatureData.identity_ID, signatureData.signature_as_vch.toString('base64'), signatureData.signature_hash);

    const mmrMatched = mmrData.mmrRoot == signatureData.signature_hash;
    console.log("hashVerified", hashVerified, "mmrMatched", mmrMatched);

    return (hashVerified && mmrMatched);

  }

  getAttestationData = (dataDescriptors) => {

    const data = {};
    dataDescriptors.forEach((dataDescriptor) => {
      const label = dataDescriptor.objectdata[Object.keys(dataDescriptor.objectdata)[0]].label;
      let key = "";

      if (label === ATTESTATION_NAME.vdxfid) {
        key = `Attestation name`
      } else {
        key = IdentityVdxfidMap[label]?.name || label;
      }

      const mime = dataDescriptor.objectdata[Object.keys(dataDescriptor.objectdata)[0]].mimetype || "";
      if (mime.startsWith("text/")) {
        data[key] = { "message": dataDescriptor.objectdata[Object.keys(dataDescriptor.objectdata)[0]].objectdata.message };
      } else if (mime.startsWith("image/")) {
        if (mime === "image/jpeg" || mime === "image/png") {
          data[key] = { "image": `data:${mime};base64,${Buffer.from(dataDescriptor.objectdata[Object.keys(dataDescriptor.objectdata)[0]].objectdata, "hex").toString("base64")}` };
        }
      }
    });

    return data;

  }

  updateDisplay() {
    const { deeplinkData } = this.props.route.params
    const loginConsent = new primitives.LoginConsentRequest(deeplinkData);

    if (loginConsent.challenge.attestations && loginConsent.challenge.attestations.length > 1) {
      createAlert("Error", "Only one attestation is allowed to be received at a time.");
      this.cancel();
      return;
    }

    const checkAttestation = loginConsent.challenge.attestations[0];

    if (checkAttestation.vdxfkey === primitives.ATTESTATION_PROVISION_OBJECT.vdxfid) {

      const dataDescriptorObject = new VdxfUniValue();
      dataDescriptorObject.fromBuffer(Buffer.from(checkAttestation.data, "hex"));
      const vdxfObjectsKeys = Array.from(dataDescriptorObject.values.keys());

      if (!Array.isArray(vdxfObjectsKeys) && vdxfObjectsKeys.length === 0) {
        createAlert("Error", "Invalid data descriptor object in Attestation.");
        this.cancel();
        return;
      }

      if (vdxfObjectsKeys.indexOf(VDXF_Data.DataURLKey.vdxfid) > -1) {

        // TODO: Handle fetch data from URL
      }
      else if ((vdxfObjectsKeys.indexOf(VDXF_Data.MMRDescriptorKey.vdxfid) > -1) &&
        (vdxfObjectsKeys.indexOf(VDXF_Data.SignatureDataKey.vdxfid))) {

        const signatureData = dataDescriptorObject.values.get(VDXF_Data.SignatureDataKey.vdxfid);
        const mmrData = dataDescriptorObject.values.get(VDXF_Data.MMRDescriptorKey.vdxfid);

        if (!this.validateAttestation(signatureData, mmrData)) {
          createAlert("Error", "Invalid attestation signature.");
          this.cancel();
          return;
        }

        const attestationName = mmrData.dataDescriptors.find((dataDescriptor) => dataDescriptor.objectdata[Object.keys(dataDescriptor.objectdata)[0]].label === ATTESTATION_NAME.vdxfid)?.objectdata;

        if (false /*!attestationName || Object.values(attestationName)[0].label !== ATTESTATION_NAME.vdxfid*/) {
          createAlert("Error", "Attestation has no name.");
          this.cancel();
          return;
        } else {

          this.setState({ attestationName: "Valu Proof of Life Attestation" /*Object.values(attestationName)[0].objectdata.message*/ });

        }

        const containingData = {}; // this.getAttestationData(mmrData.datadescriptors);
        this.setState({ attestationData: containingData, 
          completeAttestaton: {[loginConsent.getChallengeHash(1).toString('base64')]:{ name: "Valu Proof of Life Attestation", 
            signer: this.state.signerFqn, 
            data: dataDescriptorObject}}
          });

      } else {
        createAlert("Error", "Invalid attestation type.");
        this.cancel();
        return;
      }

    }
  }

  handleContinue() {
    this.setState(
      { loading: true },
      async () => {
        await modifyAttestationDataForUser(
          this.state.completeAttestaton,
          ATTESTATIONS_PROVISIONED,
          this.props.activeAccount.accountHash
        );

        this.setState({ loading: false });
        this.props.route.params.onGoBack(true);
        this.props.navigation.goBack();
        this.cancel();
      }
    );
  };


  render() {
    return LoginReceiveAttestationRender.call(this);
  }
}

const mapStateToProps = (state) => {
  return {
    activeAccount: state.authentication.activeAccount,
    encryptedPersonalData: state.personal
  }
};

export default connect(mapStateToProps)(LoginReceiveAttestation);