import React, { Component } from "react"
import { connect } from 'react-redux'
import { setServiceLoading } from "../../../../actions/actionCreators";
import { createAlert } from "../../../../actions/actions/alert/dispatchers/alert";
import { requestServiceStoredData } from "../../../../utils/auth/authBox";
import { ATTESTATION_SERVICE_ID } from "../../../../utils/constants/services";
import { VerusAttestationRender } from "./AttestationService.render";
import { ATTESTATIONS_PROVISIONED } from "../../../../utils/constants/attestations";
import { requestAttestationData } from "../../../../utils/auth/authBox";
import { modifyAttestationDataForUser, replaceAttestationDataForUser } from "../../../../actions/actions/attestations/dispatchers/attestations";
import { setAttestationData } from "../../../../actions/actions/attestations/creators/attestations";

class AttestationService extends Component {
  constructor(props) {
    super(props);
    this.state = {
      attestations: {},
      deleteModalVisible: false,
      attestationToDelete: null,
    };
    this.props.navigation.setOptions({title: 'Attestations'});
  }

  async getAttestations() {
    this.props.dispatch(setServiceLoading(true, ATTESTATION_SERVICE_ID));

    try {
      const attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
      if (attestationData) {
        console.log('Attestation Data Structure:', JSON.stringify(attestationData, null, 2));
        
        // Log the first attestation to see its structure
        const firstAttestation = Object.values(attestationData)[0];
        if (firstAttestation) {
          console.log('First Attestation Fields:', Object.keys(firstAttestation));
          console.log('First Attestation:', firstAttestation);
        }
        
        // Add timestamps to attestations that don't have them
        const attestationsWithTimestamps = {};
        let hasUpdates = false;
        
        Object.keys(attestationData).forEach(key => {
          const attestation = attestationData[key];
          if (attestation && typeof attestation === 'object') {
            // Check if attestation already has any timestamp field
            const hasTimestamp = attestation.date || 
                                attestation.timestamp || 
                                attestation.created_at || 
                                attestation.createdAt ||
                                attestation.dateReceived;
            
            if (!hasTimestamp) {
              // Add a timestamp with current date for missing timestamps
              attestationsWithTimestamps[key] = {
                ...attestation,
                dateReceived: new Date().toLocaleString(),
                timestamp: Math.floor(Date.now() / 1000) // Unix timestamp
              };
              hasUpdates = true;
            } else {
              attestationsWithTimestamps[key] = attestation;
            }
          } else {
            attestationsWithTimestamps[key] = attestation;
          }
        });
        
        // If we added timestamps, save the updated data back to storage
        if (hasUpdates) {
          try {
            await replaceAttestationDataForUser(
              attestationsWithTimestamps,
              ATTESTATIONS_PROVISIONED,
              this.props.activeAccount.accountHash
            );
            console.log('Added timestamps to attestations missing them');
          } catch (e) {
            console.warn('Failed to save updated attestations with timestamps:', e.message);
          }
        }
        
        this.setState({
          attestations: attestationsWithTimestamps
        });
      } 
    } catch (e) {
      createAlert('Error Loading Attestations', e.message);
    }

    this.props.dispatch(setServiceLoading(false, ATTESTATION_SERVICE_ID));
  }

  componentDidMount() {

    this.getAttestations();
  }

  viewDetails = (attestation) => {
    this.props.navigation.navigate("ViewAttestation", {attestation}); 
  }

  showDeleteModal = (attestation) => {
    this.setState({
      deleteModalVisible: true,
      attestationToDelete: attestation
    });
  }

  hideDeleteModal = () => {
    this.setState({
      deleteModalVisible: false,
      attestationToDelete: null
    });
  }

  deleteAttestation = async () => {
    const { attestationToDelete } = this.state;
    if (!attestationToDelete) return;

    try {
      this.props.dispatch(setServiceLoading(true, ATTESTATION_SERVICE_ID));
      
      // Get current attestations
      const currentAttestations = { ...this.state.attestations };
      
      console.log('Before deletion:', Object.keys(currentAttestations));
      console.log('Attestation to delete:', attestationToDelete);
      
      // Remove the attestation by finding and removing the matching attestation
      // Since we're dealing with attestation objects, let's use a more reliable method
      let foundKey = null;
      for (const [key, value] of Object.entries(currentAttestations)) {
        if (value === attestationToDelete) {
          foundKey = key;
          break;
        }
      }
      
      if (foundKey) {
        delete currentAttestations[foundKey];
        
        console.log('After deletion:', Object.keys(currentAttestations));
        console.log('Deleted key:', foundKey);
        
        // Update the encrypted storage
        await replaceAttestationDataForUser(
          currentAttestations,
          ATTESTATIONS_PROVISIONED,
          this.props.activeAccount.accountHash
        );
        
        // Update local state
        this.setState({
          attestations: currentAttestations,
          deleteModalVisible: false,
          attestationToDelete: null
        });
        
        
        // Reload attestations to verify deletion worked
        setTimeout(() => {
          this.getAttestations();
        }, 100);
        
      } else {
        console.log('Could not find attestation to delete - no matching key found');
        createAlert('Error', 'Could not find attestation to delete');
      }
    } catch (e) {
      console.error("Error deleting attestation:", e);
      createAlert('Error Deleting Attestation', e.message);
    } finally {
      this.props.dispatch(setServiceLoading(false, ATTESTATION_SERVICE_ID));
    }
  }

  componentDidUpdate(lastProps) {
  //  if (lastProps.encryptedIds !== this.props.encryptedIds) {
   //   this.getLinkedIds()
   // }
  }

  render() {
    return VerusAttestationRender.call(this);
  }
}

const mapStateToProps = state => {

  return {
    loading: state.services.loading[ATTESTATION_SERVICE_ID],
    attestestationdata: state.attestation,
    activeAccount: state.authentication.activeAccount
  };
};

export default connect(mapStateToProps)(AttestationService);