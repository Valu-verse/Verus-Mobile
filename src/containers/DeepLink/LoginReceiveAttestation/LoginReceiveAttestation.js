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
const { ATTESTATION_NAME, DataDescriptorKey } = primitives;
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { ATTESTATIONS_PROVISIONED } from "../../../utils/constants/attestations";
import { modifyAttestationDataForUser } from "../../../actions/actions/attestations/dispatchers/attestations";
import { validateMMRfromMmrDatadescriptor } from "../../../utils/attestations/validateMmr"
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

    const hashVerified = await verifyHash(signatureData.system_ID, signatureData.identity_ID, signatureData.signature_as_vch.toString('base64'),
      signatureData.getIdentityHash({ ...sigInfo, hash_type: sigInfo.hashtype }));

    const mmrMatched = Buffer.from(mmrData.mmrRoot.objectdata).reverse().toString('hex') == signatureData.toJson().signaturehash;
    const dataDescriptorsHashCorrect = await validateMMRfromMmrDatadescriptor(mmrData);

    console.log("hashVerified", hashVerified, "mmrMatched", mmrMatched, "dataDescriptorsHashCorrect", dataDescriptorsHashCorrect);
  
    return (!!hashVerified && !!mmrMatched && !!dataDescriptorsHashCorrect);
  }

  getAttestationData = (dataDescriptors) => {

    const data = {};
    dataDescriptors.forEach((dataDescriptor) => {
      const label = dataDescriptor[DataDescriptorKey.vdxfid].label;
      let key = "";

      if (label === ATTESTATION_NAME.vdxfid) {
        key = `Attestation name`
      } else {
        key = IdentityVdxfidMap[label]?.EN || label;
      }

      const mime = dataDescriptor[DataDescriptorKey.vdxfid].mimetype || "";
      if (mime.startsWith("text/")) {
        data[key] = { "message": dataDescriptor[DataDescriptorKey.vdxfid].objectdata.message };
      } else if (mime.startsWith("image/")) {
        if (mime === "image/jpeg" || mime === "image/png") {
          data[key] = { "image": `data:${mime};base64,${Buffer.from(dataDescriptor[DataDescriptorKey.vdxfid].objectdata, "hex").toString("base64")}` };
        }
      }
    });

    return data;

  }

  updateDisplay = async () => {
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
      const vdxfObjectsKeys = {};

      dataDescriptorObject.values.map((value) => vdxfObjectsKeys[Object.keys(value)[0]] = Object.values(value)[0]);

      if (!Object.keys(vdxfObjectsKeys)) {
        createAlert("Error", "Invalid data descriptor object in Attestation.");
        this.cancel();
        return;
      }



      if (vdxfObjectsKeys[VDXF_Data.DataURLKey.vdxfid]) {

        // TODO: Handle fetch data from URL
      }
      else if (vdxfObjectsKeys[VDXF_Data.SignatureDataKey.vdxfid] &&
        vdxfObjectsKeys[VDXF_Data.MMRDescriptorKey.vdxfid]) {

        const validatedOk = await this.validateAttestation(vdxfObjectsKeys[VDXF_Data.SignatureDataKey.vdxfid],
          vdxfObjectsKeys[VDXF_Data.MMRDescriptorKey.vdxfid]);
      
        if (!validatedOk) {
          createAlert("Error", "Invalid attestation signature.");
          this.cancel();
          return;
        }

        const attestationItems = vdxfObjectsKeys[VDXF_Data.MMRDescriptorKey.vdxfid].dataDescriptors;
        const attestationDataDescriptors = attestationItems.map((dataDescriptor) => dataDescriptor.toJson().objectdata);

        let attestationName = attestationDataDescriptors.find((dataDescriptor) => dataDescriptor[DataDescriptorKey.vdxfid].label === ATTESTATION_NAME.vdxfid);

        if (attestationName && attestationName[DataDescriptorKey.vdxfid]) {
          attestationName = attestationName[DataDescriptorKey.vdxfid].objectdata.message;
          this.setState({ attestationName: attestationName });
        }
        else {
          createAlert("Error", "Attestation has no name.");
          this.cancel();
          return;
        } 

        const containingData = this.getAttestationData(attestationDataDescriptors);

        this.setState({
          attestationData: containingData,
          completeAttestaton: {
            [loginConsent.getChallengeHash(1).toString('base64')]: {
              name: "Valu Proof of Humanity",
              signer: this.state.signerFqn,
              data: checkAttestation.data
            }
          }
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