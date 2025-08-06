import moment from "moment";
import { Component } from "react"
import { connect } from 'react-redux'
import { createAlert, resolveAlert } from "../../../actions/actions/alert/dispatchers/alert"
import { modifyPersonalDataForUser } from "../../../actions/actionDispatchers";
import { requestPersonalData } from "../../../utils/auth/authBox";
import { PERSONAL_ATTRIBUTES, PERSONAL_CONTACT, PERSONAL_LOCATIONS, PERSONAL_PAYMENT_METHODS, PERSONAL_IMAGES } from "../../../utils/constants/personal";
import { provideCustomBackButton } from "../../../utils/navigation/customBack";
import { LoginShareAttestationRender } from "./LoginShareAttestation.render"
import { checkPersonalDataCatagories } from "../../../utils/personal/displayUtils";
import { handleAttestationDataSend } from "../../../utils/deeplink/handlePersonalDataSend";
import { primitives } from "verusid-ts-client"
import { ATTESTATIONS_PROVISIONED } from "../../../utils/constants/attestations";
import { requestAttestationData } from "../../../utils/auth/authBox";
import { IdentityVdxfidMap } from 'verus-typescript-primitives/dist/utils/IdentityData';
import { getIdentity } from '../../../utils/api/channels/verusid/callCreators';
import { createAttestationResponse } from "../../../utils/attestations/createAttestationResponse";
import * as VDXF_Data from "verus-typescript-primitives/dist/vdxf/vdxfdatakeys";
import { at } from "lodash";
const { AttestationPair } = require("verus-typescript-primitives/dist/vdxf/classes/attestation/AttestationDetails");
const { getSignatureInfo } = require("../../../utils/api/channels/vrpc/requests/getSignatureInfo");

class LoginShareAttestation extends Component {
  constructor(props) {
    super(props);
    this.state = {
      attestationName: "",
      attestationAcceptedAttestors: [],
      attestationAcceptedAttestorsFqns: [], // Store FQNs for UI display
      attestationRequestedFields: [],
      attestationRequestedVdxfKeys: [],
      attestationID: "",
      loading: false,
      ready: false,
      attestationDataURL: "",
      signerFqn: this.props.route.params.signerFqn,
      multipleAttestations: false,
      selectedAttestations: [],
      requestedKey: ""
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

  createAttestationReply = async () => {
    if (this.state.multipleAttestations) {
      // For multiple attestations, send all selected attestation IDs and no key filtering
      const attestationIds = this.state.selectedAttestations.map(attestation => attestation.id);
      const reply = await createAttestationResponse(attestationIds, null, true);
      return reply;
    } else {
      // For single attestation, send single ID with key filtering
      const reply = await createAttestationResponse(this.state.attestationID, this.state.attestationRequestedVdxfKeys, false);
      return reply;
    }
  }

  /**
   * Parse login consent request and extract attestation requirements
   */
  parseLoginConsentRequest = (deeplinkData) => {
    const loginConsent = new primitives.LoginConsentRequest(deeplinkData);
    
    let attestationName = "";
    let attestationAcceptedAttestors = [];
    let attestationAcceptedAttestorsFqns = [];
    let requestedKey = "";
    let multipleAttestations = false;
    const subjectKeys = {};

    const attestationDataURL = loginConsent.challenge.subject
      .filter((permission) => permission.vdxfkey === primitives.LOGIN_CONSENT_PERSONALINFO_WEBHOOK_VDXF_KEY.vdxfid);
 

    // Check for multiple attestations flag in requested_access
    for (const access of loginConsent.challenge.requested_access) {
      if (access.vdxfkey === primitives.ATTESTATION_VIEW_REQUEST_MULTIPLEATTESTATIONS?.vdxfid) {
        multipleAttestations = true;
        break;
      }
    }

    // Parse each permission in the subject
    for (const permission of loginConsent.challenge.subject) {
      if (permission.vdxfkey === primitives.ATTESTATION_VIEW_REQUEST_NAME.vdxfid) {
        attestationName = permission.data;
      } else if (permission.vdxfkey === primitives.ATTESTATION_VIEW_REQUEST_KEY?.vdxfid) {
        requestedKey = permission.data;
      } else if (permission.vdxfkey === primitives.ATTESTATION_VIEW_REQUEST_ATTESTOR.vdxfid) {
        // This will be processed separately due to async nature
        continue;
      } else {
        subjectKeys[permission.data] = true;
      }
    }

    return {
      loginConsent,
      attestationName,
      requestedKey,
      multipleAttestations,
      subjectKeys,
      attestationDataURL: attestationDataURL.length > 0 ? 
        { vdxfkey: attestationDataURL[0].vdxfkey, uri: attestationDataURL[0].data } : null
    };
  };

  /**
   * Process attestor permissions and get their friendly names
   */
  processAttestors = async (loginConsent) => {
    const attestationAcceptedAttestors = [];
    const attestationAcceptedAttestorsFqns = [];

    for (const permission of loginConsent.challenge.subject) {
      if (permission.vdxfkey === primitives.ATTESTATION_VIEW_REQUEST_ATTESTOR.vdxfid) {
        try {
          const reply = await getIdentity(loginConsent.system_id, permission.data);
          const attestorFqn = reply.result.friendlyname;
          const attestorIdentityAddress = reply.result.identity.identityaddress;

          attestationAcceptedAttestors.push(attestorIdentityAddress);
          attestationAcceptedAttestorsFqns.push(attestorFqn);
        } catch (e) {
          console.log("Error getting attestation signer ", e);
          throw new Error(`Failed to get attestor info: ${e.message}`);
        }
      }
    }

    return { attestationAcceptedAttestors, attestationAcceptedAttestorsFqns };
  };

  /**
   * Parse a single attestation and check if it matches criteria
   */
  parseAttestation = (attestationBuffer, attestationId, criteria) => {
    const { attestationName, requestedKey, subjectKeys, attestationAcceptedAttestors } = criteria;

    try {
      const attestationDetails = new AttestationPair();
      attestationDetails.fromBuffer(Buffer.from(attestationBuffer.data, "hex"));

      if (!attestationDetails || !attestationDetails.mmrDescriptor) {
        console.warn("Invalid attestation details for attestation", attestationId);
        return null;
      }

      const mmrDescriptor = attestationDetails.mmrDescriptor;
      const signatureData = attestationDetails.signatureData;

      // Check if the signer matches accepted attestors
      if (attestationAcceptedAttestors.indexOf(signatureData.identity_ID) === -1) {
        return null;
      }

      let hasMatchingName = false;
      let hasRequestedKey = false;
      let currentAttestationFields = [];

      // Process data descriptors
      for (const dataDescriptor of mmrDescriptor.dataDescriptors) {
        const item = dataDescriptor.toJson().objectdata[VDXF_Data.DataDescriptorKey.vdxfid];

        // Check for attestation name match (Scenario 1)
        if (item.label === primitives.ATTESTATION_NAME.vdxfid) {
          if (attestationName && item.objectdata.message === attestationName) {
            hasMatchingName = true;
          }
        }

        // Check for requested key match (Scenario 2)
        if (requestedKey && item.label === requestedKey) {
          hasRequestedKey = true;
        }

        // Collect fields that match subject keys
        if (subjectKeys[item.label]) {
          const name = IdentityVdxfidMap[item.label]?.EN || item.label;
          currentAttestationFields.push(name);
        }
      }

      // Determine if this attestation matches criteria
      const matchesCriteria = attestationName ? 
        (hasMatchingName && currentAttestationFields.length > 0) : // Scenario 1: name-based
        (hasRequestedKey); // Scenario 2: key-based

      if (matchesCriteria) {
        return {
          fields: currentAttestationFields,
          id: attestationId,
          attestationDetails: attestationDetails,
          name: attestationBuffer.name || "Unknown Attestation" // Add the name from the attestation object
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing attestation data for ID', attestationId, ':', error);
      return null;
    }
  };
  /**
   * Find attestations that match the criteria
   */
  findMatchingAttestations = (attestationData, criteria) => {
    const matchingAttestations = [];
    const attestationDataKeys = Object.keys(attestationData);
    const attestationDataValues = Object.values(attestationData);

    for (let i = 0; i < attestationDataKeys.length; i++) {
      const parsedAttestation = this.parseAttestation(
        attestationDataValues[i], 
        attestationDataKeys[i], 
        criteria
      );

      if (parsedAttestation) {
        matchingAttestations.push(parsedAttestation);
      }
    }

    return matchingAttestations;
  };

  /**
   * Select the best attestation(s) based on height and scenario
   */
  selectBestAttestations = async (matchingAttestations, multipleAttestations) => {
    if (matchingAttestations.length === 0) {
      return { attestationRequestedFields: [], attestationID: "", selectedAttestations: [] };
    }

    // Get heights for all matching attestations
    const attestationsWithHeights = [];

    for (const attestation of matchingAttestations) {
      try {
        const signatureData = attestation.attestationDetails.signatureData;
        const sigInfo = await getSignatureInfo(
          signatureData.system_ID,
          signatureData.identity_ID,
          signatureData.signature_as_vch.toString('base64'),
        );

        attestationsWithHeights.push({
          ...attestation,
          height: sigInfo.height
        });

        console.log(`Attestation ${attestation.id} height: ${sigInfo.height}`);
      } catch (error) {
        console.error(`Error getting height for attestation ${attestation.id}:`, error);
        // Skip attestations we can't get height for
      }
    }

    if (attestationsWithHeights.length === 0) {
      return { attestationRequestedFields: [], attestationID: "", selectedAttestations: [] };
    }

    // Sort by height (highest first)
    attestationsWithHeights.sort((a, b) => b.height - a.height);

    if (multipleAttestations) {
      // Scenario 2: Return all matching attestations
      console.log(`Selected ${attestationsWithHeights.length} attestations for multiple attestation request`);
         return {
        attestationRequestedFields: [], // Not used in multiple attestation scenario
        attestationID: "", // Not used in multiple attestation scenario
        selectedAttestations: attestationsWithHeights
      };
    } else {
      // Scenario 1: Return only the newest (highest height) attestation
      const bestAttestation = attestationsWithHeights[0];
      console.log(`Selected attestation ${bestAttestation.id} with height ${bestAttestation.height}`);
      return {
        attestationRequestedFields: bestAttestation.fields,
        attestationID: bestAttestation.id,
        selectedAttestations: [bestAttestation]
      };

    }
  };


  /**
   * Main function to update display state based on deeplink data
   */
  updateDisplay = async () => {
    try {
      const { deeplinkData } = this.props.route.params;

      // Parse the login consent request
      const {
        loginConsent,
        attestationName,
        requestedKey,
        multipleAttestations,
        subjectKeys,
        attestationDataURL
      } = this.parseLoginConsentRequest(deeplinkData);

      // Process attestors
      const { attestationAcceptedAttestors, attestationAcceptedAttestorsFqns } = 
        await this.processAttestors(loginConsent);

      // Load attestation data
      let attestationData;
      try {
        attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
      } catch (e) {
        createAlert('Error Loading Attestations', e.message);
        return;
      }

      // Find matching attestations
      const criteria = {
        attestationName,
        requestedKey,
        subjectKeys,
        attestationAcceptedAttestors
      };

      const matchingAttestations = this.findMatchingAttestations(attestationData, criteria);

      // Select the best attestation(s) based on scenario
      const { attestationRequestedFields, attestationID, selectedAttestations } = 
        await this.selectBestAttestations(matchingAttestations, multipleAttestations);

      // Get requested VDXF keys for the response
      const attestationRequestedVdxfKeys = loginConsent.challenge.subject
        .map((permission) => permission.data);

      // Update component state
      this.setState({
        attestationRequestedFields,
        attestationAcceptedAttestors,
        attestationAcceptedAttestorsFqns,
        attestationName,
        attestationID,
        attestationDataURL,
        attestationRequestedVdxfKeys,
        multipleAttestations,
        selectedAttestations, // Store all selected attestations for scenario 2
        requestedKey
      });

    } catch (error) {
      console.error('Error in updateDisplay:', error);
      createAlert('Error', `Failed to process attestation request: ${error.message}`);
    }
  }

  async handleContinue() {
    this.setState({ loading: true });

    const createdAttestation = await this.createAttestationReply()

    const attestationType = this.state.multipleAttestations ? 
      `${this.state.selectedAttestations.length} attestation${this.state.selectedAttestations.length > 1 ? 's' : ''}` : 
      "attestation";

    createAlert(
      "Send Selected Attestation info",
      `Are you sure you want to send your selected ${attestationType} data to: \n\n${this.state.signerFqn}`,
      [
        {
          text: "No",
          onPress: () => {
            resolveAlert();
          },
        },
        {
          text: "Yes",
          onPress: () => {
            resolveAlert();
            handleAttestationDataSend(createdAttestation, this.state.attestationDataURL)
              .then(() => {
                this.setState({ loading: false });
                this.props.route.params.onGoBack(true);
                this.props.navigation.goBack();
                this.cancel();
              }).catch((e) => {

                this.setState({ loading: false });
                createAlert("Error, Failed to Send Attestation, server may be unavailable.", e.message);

              })
          },
        },
      ],
      {
        cancelable: false,
      }
    );
  };
  render() {
    return LoginShareAttestationRender.call(this);
  }
}

const mapStateToProps = (state) => {
  return {
    activeAccount: state.authentication.activeAccount,
    encryptedPersonalData: state.personal
  }
};

export default connect(mapStateToProps)(LoginShareAttestation);