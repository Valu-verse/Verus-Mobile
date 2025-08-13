import { Component } from "react"
import { connect } from 'react-redux'
import { createAlert, resolveAlert } from "../../../actions/actions/alert/dispatchers/alert"
import { LoginReceiveAttestationRender } from "./LoginReceiveAttestation.render"
import { primitives } from "verusid-ts-client"
import { AttestationDetails } from "verus-typescript-primitives/dist/vdxf/classes/attestation/AttestationDetails";
import { verifyHash } from "../../../utils/api/channels/vrpc/requests/verifyHash";
import { getSignatureInfo } from "../../../utils/api/channels/vrpc/requests/getSignatureInfo";
import { IdentityVdxfidMap } from "verus-typescript-primitives/dist/utils/IdentityData";
import { ATTESTATIONS_PROVISIONED } from "../../../utils/constants/attestations";
import { modifyAttestationDataForUser } from "../../../actions/actions/attestations/dispatchers/attestations";
import { validateMMRfromMmrDatadescriptor } from "../../../utils/attestations/validateMmr"
import { requestAttestationData } from "../../../utils/auth/authBox"
import { downloadAttestationData as downloadAttestationUtil } from "../../../utils/attestations/downloadAttestation"
import { getIdentity } from "../../../utils/api/channels/verusid/callCreators"
import { convertFqnToDisplayFormat } from '../../../utils/fullyqualifiedname';

const { ATTESTATION_NAME, DataDescriptorKey } = primitives;
class LoginReceiveAttestation extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      ready: false,
      signerFqn: this.props.route.params.signerFqn,
      attestationName: "",
      attestationData: {},
      completeAttestaton: {},
      downloadedAttestations: null,
      isDownloadedAttestation: false,
      attestationFqns: {}
    };
  }

  componentDidMount() {
    if (this.props.route.params.downloadUrl) {
      this.handleDownloadAttestation();
    } else {
      this.updateDisplay();
    }
  }

  handleDownloadAttestation = async () => {
    try {
      this.setState({ loading: true });

      const downloadUrl = this.props.route.params.downloadUrl;
      if (!downloadUrl) {
        throw new Error("No download URL provided");
      }

      const attestationResponse = await downloadAttestationUtil(downloadUrl);
      const attestationDetails = AttestationDetails.fromJson(attestationResponse);

      if (!attestationDetails.isValid() || attestationDetails.attestations.length === 0) {
        throw new Error("Invalid or empty attestation details");
      }

      // Format for processing
      const formattedAttestationDetails = {
        version: attestationDetails.version.toNumber(),
        attestations: attestationDetails.attestations.map((attestationPair, index) => ({
          mmrdescriptor: attestationPair.mmrDescriptor.toJson(),
          signaturedata: attestationPair.signatureData.toJson(),
          index: index
        })),
        flags: attestationDetails.flags.toNumber(),
        label: attestationDetails.label,
        id: attestationDetails.id,
        timestamp: attestationDetails.timestamp ? attestationDetails.timestamp.toNumber() : Date.now()
      };

      // Process the downloaded attestation
      await this.processDownloadedAttestations(formattedAttestationDetails);

    } catch (error) {
      console.error('Download error details:', error);
      createAlert("Download Error", `Failed to download attestation data: ${error.message}`);
      this.setState({ loading: false });
      this.cancel();
    }
  }

  processDownloadedAttestations = async (downloadedAttestations) => {
    if (!downloadedAttestations) {
      createAlert("Error", "No attestation data found.");
      this.cancel();
      return;
    }

    try {
      const processedData = {};
      const completeAttestationObjects = {};
      let combinedName = downloadedAttestations.label || "Downloaded Attestation";
      const validationResults = [];

      // Check if downloadedAttestations is in the new AttestationDetails format
      if (!downloadedAttestations.attestations || !Array.isArray(downloadedAttestations.attestations)) {
        createAlert("Error", "Unsupported attestation format received.");
        this.cancel();
        return;
      }

      // Process each attestation in the AttestationDetails object
      for (let index = 0; index < downloadedAttestations.attestations.length; index++) {
        const attestationPair = downloadedAttestations.attestations[index];

        // Recreate AttestationPair objects from the JSON data
        const { AttestationPair } = require("verus-typescript-primitives/dist/vdxf/classes/attestation/AttestationDetails");
        const recreatedPair = AttestationPair.fromJson(attestationPair);

        // Validate the attestation pair
        const isValid = await this.validateAttestation(
          recreatedPair.signatureData,
          recreatedPair.mmrDescriptor
        );

        validationResults.push({ isValid });

        // Extract attestation name and MMR hash
        const attestationName = isValid ? this.extractAttestationName(recreatedPair.mmrDescriptor) : null;
        const mmrHash = this.extractMmrHash(recreatedPair.mmrDescriptor);
        const extractedId = this.extractAttestationId(recreatedPair.mmrDescriptor);

        // Store processed data
        processedData[mmrHash] = {
          validated: isValid,
          attestationName: attestationName,
          issuer: this.state.signerFqn,
          timestamp: downloadedAttestations.timestamp || Date.now(),
          index: index,
          identityId: recreatedPair.signatureData.identity_ID,
          systemId: recreatedPair.signatureData.system_ID,
          internal_id: extractedId
        };

        // Store complete attestation object if valid
        if (isValid) {
          completeAttestationObjects[mmrHash] = {
            name: attestationName || `Attestation ${index + 1}`,
            signer: this.state.signerFqn,
            data: recreatedPair.toBuffer().toString('hex'),
            downloaded: true,
            timestamp: downloadedAttestations.timestamp || Date.now(),
            metadata: {
              originalLabel: downloadedAttestations.label,
              originalId: downloadedAttestations.id,
              version: downloadedAttestations.version,
              flags: downloadedAttestations.flags
            },
            type: 'individual',
            validated: isValid,
            issuer: this.state.signerFqn,
            attestationIndex: index
          };
        }
      }

      // Update combined name based on content
      if (downloadedAttestations.label) {
        combinedName = downloadedAttestations.label;
      } else if (downloadedAttestations.attestations.length > 1) {
        combinedName = `${downloadedAttestations.attestations.length} Attestations`;
      }

      // Check if all attestations are valid
      const allValid = validationResults.every(result => result.isValid);
      if (!allValid) {
        createAlert("Validation Error", "One or more downloaded attestations failed validation.");
        this.cancel();
        return;
      }

      this.setState({
        isDownloadedAttestation: true,
        downloadedAttestations,
        attestationName: combinedName,
        attestationData: processedData,
        ready: true,
        loading: false,
        completeAttestaton: completeAttestationObjects
      });

      // Resolve FQNs for identity IDs
      await this.resolveFqnsForAttestations(processedData);
    } catch (error) {
      console.error('Error processing downloaded attestations:', error);
      createAlert("Processing Error", "Failed to process downloaded attestation data.");
      this.cancel();
    }
  }

  resolveFqnsForAttestations = async (attestationData) => {
    try {
      const fqnMap = {};
      
      for (const [key, data] of Object.entries(attestationData)) {
        if (data.identityId && data.systemId) {
          try {
            const identityResult = await getIdentity(data.systemId, data.identityId);

            if (identityResult?.result?.fullyqualifiedname) {
              fqnMap[key] = convertFqnToDisplayFormat(identityResult.result.fullyqualifiedname);
            } else {
              throw new Error(`Failed to resolve FQN for identity ID: ${data.identityId}`);
            }
          } catch (error) {
            console.warn(`Failed to resolve FQN for attestation ${key}:`, error);
            fqnMap[key] = this.state.signerFqn; // fallback
          }
        }
      }

      this.setState({ attestationFqns: fqnMap });
    } catch (error) {
      console.error('Error resolving FQNs for attestations:', error);
    }
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

  extractMmrHash = (mmrDescriptor) => {
    try {
      return Buffer.from(mmrDescriptor.mmrRoot.objectdata).reverse().toString('hex');
    } catch (error) {
      console.error('Error extracting MMR hash:', error);
      // Fallback to using a generated hash if MMR extraction fails
      return Buffer.from(mmrDescriptor.toBuffer()).toString('base64').substring(0, 32);
    }
  }

  extractAttestationName = (mmrDescriptor) => {
    try {
      const attestationItems = mmrDescriptor.dataDescriptors;
      const attestationDataDescriptors = attestationItems.map((dataDescriptor) => dataDescriptor.toJson().objectdata);

      const nameDescriptor = attestationDataDescriptors.find((dataDescriptor) =>
        dataDescriptor[DataDescriptorKey.vdxfid].label === ATTESTATION_NAME.vdxfid
      );

      if (nameDescriptor && nameDescriptor[DataDescriptorKey.vdxfid]) {
        return nameDescriptor[DataDescriptorKey.vdxfid].objectdata.message;
      }
    } catch (error) {
      console.warn('Error extracting attestation name:', error);
    }
    return null;
  }

  extractAttestationId = (mmrDescriptor) => {
    try {
      const attestationItems = mmrDescriptor.dataDescriptors;
      const attestationDataDescriptors = attestationItems.map((dataDescriptor) => dataDescriptor.toJson().objectdata);

      const nameDescriptor = attestationDataDescriptors.find((dataDescriptor) =>
        dataDescriptor[DataDescriptorKey.vdxfid].label === 'i6htkAtLSyUFr1YBFD13U9TSgPgQe2yDQZ' // CLAIM_ID
      );

      if (nameDescriptor && nameDescriptor[DataDescriptorKey.vdxfid]) {
        return nameDescriptor[DataDescriptorKey.vdxfid].objectdata.message;
      }
    } catch (error) {
      console.warn('Error extracting attestation id:', error);
      return null;
    }
    return null;
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
    if (this.state.isDownloadedAttestation) {
      return;
    }

    const { deeplinkData } = this.props.route.params
    const loginConsent = new primitives.LoginConsentRequest(deeplinkData);

    if (loginConsent.challenge.attestations?.length > 1) {
      createAlert("Error", "Only one attestation is allowed to be received at a time.");
      this.cancel();
      return;
    }

    const checkAttestation = loginConsent.challenge.attestations[0];

    try {
      // Parse the AttestationDetails from buffer
      const attestationDetails = new AttestationDetails();
      attestationDetails.fromBuffer(Buffer.from(checkAttestation.data, "base64"));

      if (!attestationDetails.isValid() || attestationDetails.attestations.length === 0) {
        createAlert("Error", "Invalid attestation details.");
        this.cancel();
        return;
      }

      const completeAttestationObjects = {};
      let attestationName = attestationDetails.label || "Received Attestation";

      // Process each attestation pair in the AttestationDetails
      for (let i = 0; i < attestationDetails.attestations.length; i++) {
        const attestationPair = attestationDetails.attestations[i];
        const signatureData = attestationPair.signatureData;
        const mmrData = attestationPair.mmrDescriptor;

        // Validate the attestation
        const validatedOk = await this.validateAttestation(signatureData, mmrData);

        if (!validatedOk) {
          createAlert("Error", `Invalid attestation signature for attestation ${i + 1}.`);
          this.cancel();
          return;
        }

        // Extract attestation name using helper method
        const extractedName = this.extractAttestationName(mmrData);
        if (extractedName && i === 0) {
          attestationName = extractedName;
        }

        const extractedId = this.extractAttestationId(mmrData);

        // Generate MMR hash using helper method
        const mmrHash = this.extractMmrHash(mmrData);

        // Check if this attestation already exists
        const attestationExists = await this.checkIfAttestationExists(mmrHash);

        if (attestationExists) {
          createAlert("Error", `You already have attestation "${extractedName || `attestation ${i + 1}`}" stored`, [
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

        // Store individual attestation with MMR hash as key
        completeAttestationObjects[mmrHash] = {
          name: extractedName || `${attestationName} ${i + 1}`,
          signer: this.state.signerFqn,
          data: attestationPair.toBuffer().toString('hex'),
          timestamp: attestationDetails.timestamp ? attestationDetails.timestamp.toNumber() : Date.now(),
          id: attestationDetails.id || undefined,
          validated: true,
          internal_id: extractedId
        };
      }

      // Get attestation data for display (using first attestation's data)
      const firstAttestationPair = attestationDetails.attestations[0];
      const firstMmrData = firstAttestationPair.mmrDescriptor;
      const attestationItems = firstMmrData.dataDescriptors;
      const attestationDataDescriptors = attestationItems.map((dataDescriptor) => dataDescriptor.toJson().objectdata);
      const containingData = this.getAttestationData(attestationDataDescriptors);

      this.setState({
        attestationName: attestationName,
        attestationData: containingData,
        ready: true,
        completeAttestaton: completeAttestationObjects
      });

    } catch (error) {
      console.error('Error processing AttestationDetails:', error);
      createAlert("Error", "Failed to process attestation data.");
      this.cancel();
      return;
    }
  }

  handleContinue = () => {
    this.setState({ loading: true }, async () => {
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
    });
  };

  viewAttestation = (key, data) => {
    try {
      // Get the complete attestation data for this specific attestation
      const attestationData = this.state.completeAttestaton[key];
      
      if (!attestationData) {
        createAlert("Error", "Attestation data not found.");
        return;
      }

      // Navigate to ViewAttestation screen with the individual attestation data
      this.props.navigation.navigate('ViewAttestation', {
        attestation: {
          data: attestationData.data,
          signer: attestationData.signer || this.state.signerFqn,
          name: attestationData.name || data.attestationName,
          timestamp: attestationData.timestamp
        }
      });
    } catch (error) {
      console.error('Error opening attestation view:', error);
      createAlert("Error", "Failed to open attestation view.");
    }
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