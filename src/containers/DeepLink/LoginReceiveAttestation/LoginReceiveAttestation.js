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
import { requestAttestationData } from "../../../utils/auth/authBox"
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

  checkIfAttestationExists = async (attestationHash) => {
    try {
      const existingAttestations = await requestAttestationData(ATTESTATIONS_PROVISIONED);
      
      if (existingAttestations && typeof existingAttestations === 'object') {
        return existingAttestations.hasOwnProperty(attestationHash);
      }
      
      return false;
    } catch (error) {
      console.error('Error checking existing attestations:', error);
      return false;
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

        // Generate the hash for this attestation to check if it already exists
        const attestationHash = loginConsent.getChallengeHash(1).toString('base64');
        
        // Check if this attestation already exists
        const attestationExists = await this.checkIfAttestationExists(attestationHash);
        
        if (attestationExists) {
          createAlert("Error", "You already have this attestation stored", [
            {
              text: "Cancel",
              onPress: () => {
                this.setState({ loading: false });             
                resolveAlert(true);
                this.cancel();
              }
            }
          ]);
          return;
        }

        this.setState({
          attestationData: containingData,
          completeAttestaton: {
            [attestationHash]: {
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

  handleContinue = () => {
    this.setState(
      { loading: true },
      async () => {
        try {
          await modifyAttestationDataForUser(
            this.state.completeAttestaton,
            ATTESTATIONS_PROVISIONED,
            this.props.activeAccount.accountHash
          );

          this.setState({ loading: false });
          this.props.route.params.onGoBack(true);
          this.props.navigation.goBack();
          this.cancel();
        } catch (error) {
          console.error('Error saving attestation:', error);
          this.setState({ loading: false });
          createAlert("Error", "Failed to save attestation. Please try again.");
        }
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