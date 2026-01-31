import moment from "moment";
import { Component } from "react"
import { connect } from 'react-redux'
import { BN } from "bn.js";
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
import { setPermissionAgreed } from "../../../actions/actions/deeplink/creators/passthroughData";
import { LOGIN_PERMISSION_TYPES } from "../../../utils/constants/loginPermissions";
const { AttestationPair } = require("verus-typescript-primitives/dist/vdxf/classes/attestation/AttestationDetails");
const { getSignatureInfo } = require("../../../utils/api/channels/vrpc/requests/getSignatureInfo");
const { RequestInformation, RequestItem } = require("verus-typescript-primitives/dist/vdxf/classes/attestation/InformationRequest");

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
      requestedKey: "",
      challengeId: ""
    };

  }

  componentDidMount() {
    this.updateDisplay();
  }

  cancel = () => {
    if (this.props.cancel) {
      this.props.cancel()
    }
  }

  createAttestationReply = async () => {
    if (this.state.multipleAttestations) {
      // For multiple attestations or collections, process each one individually
      const processedAttestations = [];
      
      for (const attestation of this.state.selectedAttestations) {
        if (attestation.requestFormat && attestation.requestFormat.isPartial) {
          // For partial data requests, apply key filtering
          const reply = await createAttestationResponse(attestation, attestation.requestFormat.requestedKeys, false);
          processedAttestations.push(reply);
        } else if (attestation.requestFormat && attestation.requestFormat.isCollection) {
          // For collection requests, send the full attestation without filtering
          const reply = await createAttestationResponse(attestation, null, false);
          processedAttestations.push(reply);
        } else {
          // For full data requests, send as single attestation without filtering
          const reply = await createAttestationResponse(attestation, null, false);
          processedAttestations.push(reply);
        }
      }
      
      // Return array if multiple attestations, single if only one
      return processedAttestations.length === 1 ? processedAttestations[0] : processedAttestations;
    } else {
      // For single attestation, send the selected attestation object with appropriate formatting
      const selection = this.state.selectedAttestations && this.state.selectedAttestations[0];
      
      if (selection && selection.requestFormat && selection.requestFormat.isPartial) {
        // Apply key filtering for partial requests
        const reply = await createAttestationResponse(selection, selection.requestFormat.requestedKeys, false);
        return reply;
      } else {
        // Send full attestation or collection as single attestation
        const reply = await createAttestationResponse(selection, null, false);
        return reply;
      }
    }
  }

  /**
   * Parse login consent request for ATTESTATION_READ_REQUEST and webhook URL
   */
  parseLoginConsentRequest = (deeplinkData) => {
    const loginConsent = new primitives.LoginConsentRequest(deeplinkData);

    // Optional webhook URL
    const webhookSubject = loginConsent.challenge.subject
      .find((permission) => permission.vdxfkey === primitives.LOGIN_CONSENT_PERSONALINFO_WEBHOOK_VDXF_KEY.vdxfid);
    const attestationDataURL = webhookSubject ? { vdxfkey: webhookSubject.vdxfkey, uri: webhookSubject.data } : null;

    // Required ATTESTATION_READ_REQUEST
    const readReqSubject = loginConsent.challenge.subject
      .find((permission) => permission.vdxfkey === primitives.ATTESTATION_READ_REQUEST.vdxfid);

    if (!readReqSubject) {
      throw new Error("Missing ATTESTATION_READ_REQUEST in login consent subject");
    }

    // Constructor requires a data object; then we overwrite with fromBuffer
    const infoReq = new RequestInformation({ version: RequestInformation.DEFAULT_VERSION, items: [] });

    infoReq.fromBuffer(Buffer.from(readReqSubject.data, 'base64'));
    
    // Extract challenge_id from the login consent challenge
    const challengeId = loginConsent.challenge.challenge_id;
    
    return { loginConsent, attestationDataURL, infoRequest: infoReq, challengeId };
  };

  /**
   * Resolve signer FQNs for display
   */
  resolveSignerFqns = async (system_id, signerIds = []) => {
    const unique = Array.from(new Set(signerIds.filter(Boolean)));
    const fqnList = [];
    for (const signer of unique) {
      try {
        const reply = await getIdentity(system_id, signer);
        fqnList.push(reply.result.friendlyname);
      } catch (e) {
        console.log("Error getting signer FQN", e);
      }
    }
    return fqnList;
  }

  /**
   * Find attestations matching a RequestItem (by id key/value and signer)
   */
  findMatchesForRequestItem = (requestItem, attestationData) => {
    const matches = [];
    const attestationDataKeys = Object.keys(attestationData);
    const attestationDataValues = Object.values(attestationData);

    // id is an object with key/value pairs we need to match to datadescriptors
    const idKeys = Object.keys(requestItem.id || {});
    if (idKeys.length === 0) return matches;

    // Check if this is a COLLECTION request (format & 4)
    const format = requestItem.format || new BN(0);
    const isCollection = format.and(RequestItem.COLLECTION).gt(new BN(0)); // COLLECTION

    for (let i = 0; i < attestationDataKeys.length; i++) {
      const attestationId = attestationDataKeys[i];
      const att = attestationDataValues[i];
      try {
        const attestationDetails = new AttestationPair();
        attestationDetails.fromBuffer(Buffer.from(att.data, 'hex'));
        if (!attestationDetails || !attestationDetails.mmrDescriptor) continue;

        const signatureData = attestationDetails.signatureData;
        // Signer must match
        if (requestItem.signer && signatureData.identity_ID !== requestItem.signer) continue;

        // For COLLECTION, check if ANY of the id keys/values match
        // For non-COLLECTION, check if ALL id keys/values match (original behavior)
        let matchFound = false;
        let matchingDescriptors = [];

        if (isCollection) {
          // COLLECTION: Match any of the id keys/values
          for (const idKey of idKeys) {
            const idValue = requestItem.id[idKey];
            
            for (const dataDescriptor of attestationDetails.mmrDescriptor.dataDescriptors) {
              const dd = dataDescriptor.toJson().objectdata[VDXF_Data.DataDescriptorKey.vdxfid];
              
              // Match by key only (when value is empty string) or by key-value pair
              const keyMatches = dd?.label === idKey;
              const valueMatches = idValue === "" || dd?.objectdata?.message === idValue;
              
              if (keyMatches && valueMatches) {
                matchFound = true;
                matchingDescriptors.push(dataDescriptor);
                break; // Found match for this id key, move to next
              }
            }
          }
        } else {
          // Non-COLLECTION: Original behavior - match first key/value pair
          const idKey = idKeys[0];
          const idValue = requestItem.id[idKey];
          
          for (const dataDescriptor of attestationDetails.mmrDescriptor.dataDescriptors) {
            const dd = dataDescriptor.toJson().objectdata[VDXF_Data.DataDescriptorKey.vdxfid];
            if (dd?.label === idKey && dd?.objectdata?.message === idValue) {
              matchFound = true;
              break;
            }
          }
        }

        if (!matchFound) continue;

        // Build fields list for UI: if PARTIAL, map requestedkeys; otherwise show whole attestation
        const isPartial = format.and(RequestItem.PARTIAL_DATA).gt(new BN(0)); // RequestedFormatFlags.PARTIAL_DATA
        const fields = isPartial && Array.isArray(requestItem.requestedkeys) && requestItem.requestedkeys.length > 0
          ? requestItem.requestedkeys.map((k) => IdentityVdxfidMap[k]?.EN || k)
          : ["⚠️ All Information"];

        matches.push({
          id: attestationId,
          name: att?.name || "Attestation",
          fields,
          attestationDetails,
          raw: att, // keep the original stored attestation object for sending later
          matchingDescriptors: isCollection ? matchingDescriptors : undefined, // Store which descriptors matched for COLLECTION
        });
      } catch (e) {
        console.warn('Error parsing attestation while matching request item', e);
      }
    }

    return matches;
  }

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
   
         return {
        attestationRequestedFields: [], // Not used in multiple attestation scenario
        attestationID: "", // Not used in multiple attestation scenario
        selectedAttestations: attestationsWithHeights
      };
    } else {
      // Scenario 1: Return only the newest (highest height) attestation
      const bestAttestation = attestationsWithHeights[0];

      return {
        attestationRequestedFields: bestAttestation.fields,
        attestationID: bestAttestation.id,
        selectedAttestations: [bestAttestation]
      };

    }
  };


  /**
  * Main function to update display state based on deeplink data (new Subject flow)
   */
  updateDisplay = async () => {
    try {
      const { deeplinkData } = this.props;
      
      if (!deeplinkData || !deeplinkData.challenge) {
        createAlert("Error", "Missing attestation data in state.");
        this.cancel();
        return;
      }

    // Parse the login consent request (new model)
    const { loginConsent, attestationDataURL, infoRequest, challengeId } = this.parseLoginConsentRequest(deeplinkData);

      // Load attestation data
      let attestationData;
      try {
        attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
      } catch (e) {
        createAlert('Error Loading Attestations', e.message);
        return;
      }

      // Process RequestInformation items
      let allSelected = [];
      const signerIds = []; 
      let combinedRequestedKeys = [];

      for (const item of infoRequest.items || []) {
        // Determine format flags
        const format = item.format || new BN(0);
        const wantsCollection = format.and(RequestItem.COLLECTION).gt(new BN(0));
        const isPartial = format.and(RequestItem.PARTIAL_DATA).gt(new BN(0));
        const isFullData = format.and(RequestItem.FULL_DATA).gt(new BN(0));

        // Find matches for this item
        const matches = this.findMatchesForRequestItem(item, attestationData);
        if (matches.length === 0) continue;

        // Collect signer for display
        if (item.signer) signerIds.push(item.signer);

        // Choose best/newest or all, and annotate heights
        const { attestationRequestedFields, attestationID, selectedAttestations } =
          await this.selectBestAttestations(matches, wantsCollection);

        // Add format info to selected attestations for proper handling
        const annotatedAttestations = selectedAttestations.map(attestation => ({
          ...attestation,
          requestFormat: { 
            isPartial,
            isFullData,
            isCollection: wantsCollection,
            requestedKeys: Array.isArray(item.requestedkeys) ? item.requestedkeys : []
          }
        }));

        allSelected = allSelected.concat(annotatedAttestations);

        // Collect requested keys for partial data requests
        if (isPartial && Array.isArray(item.requestedkeys)) {
          combinedRequestedKeys = combinedRequestedKeys.concat(item.requestedkeys);
        }
      }

      // Remove duplicate requested keys
      const uniqueRequestedKeys = [...new Set(combinedRequestedKeys)];

      // Resolve signer FQNs for display (first only shown in UI)
      const attestationAcceptedAttestorsFqns = await this.resolveSignerFqns(loginConsent.system_id, signerIds);

      // Determine if we have multiple attestations or mixed request types
      const hasMultipleAttestations = allSelected.length > 1;
      const hasMixedRequestTypes = allSelected.some(a => a.requestFormat.isPartial) && 
                                  allSelected.some(a => a.requestFormat.isFullData || a.requestFormat.isCollection);
      const isMultipleScenario = hasMultipleAttestations || hasMixedRequestTypes;

      // Update component state
      if (isMultipleScenario) {
        // Multiple attestations or mixed request types - show all
        this.setState({
          attestationRequestedFields: [],
          attestationAcceptedAttestors: signerIds,
          attestationAcceptedAttestorsFqns,
          attestationName: `${allSelected.length} Attestation${allSelected.length > 1 ? 's' : ''}`,
          attestationID: '',
          attestationDataURL,
          attestationRequestedVdxfKeys: uniqueRequestedKeys,
          multipleAttestations: true,
          selectedAttestations: allSelected,
          requestedKey: '',
          challengeId
        });
      } else if (allSelected.length === 1) {
        // Single attestation request
        const selected = allSelected[0];
        const attestationName = selected?.name || '';
        const fields = selected.requestFormat.isPartial ? 
          (selected.requestFormat.requestedKeys.map(k => IdentityVdxfidMap[k]?.EN || k)) :
          ["⚠️ All Information"];

        this.setState({
          attestationRequestedFields: fields,
          attestationAcceptedAttestors: signerIds,
          attestationAcceptedAttestorsFqns,
          attestationName,
          attestationID: selected.id,
          attestationDataURL,
          attestationRequestedVdxfKeys: selected.requestFormat.requestedKeys,
          multipleAttestations: false,
          selectedAttestations: allSelected,
          requestedKey: '',
          challengeId
        });
      } else {
        throw new Error('No matching attestations found for the request');
      }

    } catch (error) {
      console.error('Error in updateDisplay:', error);
      createAlert(
        'Error',
        `Failed to process attestation request: ${error.message}` +
          `\n\nMake sure your attestation is in this profile.`,
        [
          {
            text: 'OK',
            onPress: () => {
              resolveAlert();
              this.props.navigation.goBack();
            },
          },
        ],
        { cancelable: false }
      );
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
            
            // Add challenge_id to the attestation data before sending
            let attestationDataWithChallenge;
            if (this.state.challengeId) {
              if (Array.isArray(createdAttestation)) {
                // Multiple attestations - format as array under attestations key
                attestationDataWithChallenge = {
                  challenge_id: this.state.challengeId,
                  attestations: createdAttestation
                };
              } else if (this.state.multipleAttestations && typeof createdAttestation === 'object' && createdAttestation !== null) {
                // Multiple attestations as object with numeric keys - convert to array format
                const attestationsArray = Object.values(createdAttestation);
                attestationDataWithChallenge = {
                  challenge_id: this.state.challengeId,
                  attestations: attestationsArray
                };
              } else {
                // Single attestation - wrap in array under attestations key
                attestationDataWithChallenge = {
                  challenge_id: this.state.challengeId,
                  attestations: [createdAttestation]
                };
              }
            } else {
              // No challenge_id - maintain original format but still use attestations array
              if (Array.isArray(createdAttestation)) {
                attestationDataWithChallenge = { attestations: createdAttestation };
              } else if (this.state.multipleAttestations && typeof createdAttestation === 'object' && createdAttestation !== null) {
                const attestationsArray = Object.values(createdAttestation);
                attestationDataWithChallenge = { attestations: attestationsArray };
              } else {
                attestationDataWithChallenge = { attestations: [createdAttestation] };
              }
            }
            
            handleAttestationDataSend(attestationDataWithChallenge, this.state.attestationDataURL)
              .then(() => {
                // Set view attestation permission as agreed
                const permissionIndex = this.props.route.params?.permissionIndex || 0;
                const permissionType = this.props.route.params?.permissionType || LOGIN_PERMISSION_TYPES.VIEW_ATTESTATION;
                
                this.props.dispatch(setPermissionAgreed(
                  this.props.passthrough,
                  permissionIndex,
                  permissionType,
                  {
                    sharedAttestations: createdAttestation,
                    recipientFqn: this.state.signerFqn,
                    attestationDataURL: this.state.attestationDataURL
                  }
                ));

                this.setState({ loading: false });             
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
    encryptedPersonalData: state.personal,
    deeplinkData: state.deeplink.data,
    cancel: state.deeplink.cancel,
    passthrough: state.deeplink.passthrough
  }
};

export default connect(mapStateToProps)(LoginShareAttestation);