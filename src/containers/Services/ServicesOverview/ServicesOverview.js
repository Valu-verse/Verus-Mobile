/*
  This component represents the screen the user can use to oversee all of the
  services they can connect to Verus Mobile
  - Updated 2026-01-22: Added Address Book widget integration
  - Updated 2026-01-23: Added ValuSocial widget handler, removed VerusID widget handling
  - Updated 2026-01-23: Changed ValuSocial widget to open modal instead of navigating to screen
*/  

import React, { useEffect, useState, useLayoutEffect, useCallback } from "react"
import { useDispatch, useSelector } from 'react-redux'
import { clearSecureLoadingData } from "../../../actions/actionCreators";
import { ServicesOverviewRender } from "./ServicesOverview.render"
import { requestAttestationData } from '../../../utils/auth/authBox';
import { ATTESTATIONS_PROVISIONED } from '../../../utils/constants/attestations';
import { VALU_SERVICE_ID } from '../../../utils/constants/services';
import { ATTESTATION_WIDGET_TYPE, ADDRESS_BOOK_WIDGET_TYPE, VALU_SOCIAL_WIDGET_TYPE } from '../../../utils/constants/widgets';

const ServicesOverview = ({ navigation }) => {
  const dispatch = useDispatch();
  const passthrough = useSelector(state => state.secureLoading.successData);
  const activeAccount = useSelector(state => state.authentication.activeAccount);
  const attestation = useSelector((state) => state.attestation);
  const addressBookAddresses = useSelector((state) => state.addressBook?.addresses || []);

  const [hasValuProofOfPersonhood, setHasValuProofOfPersonhood] = useState(false);
  const [valuSocialModalVisible, setValuSocialModalVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (passthrough && passthrough.service) {
      openService(passthrough.service)
      dispatch(clearSecureLoadingData())
    }
  }, [passthrough]);

  useEffect(() => {
    // Check for specific "Valu Proof of Personhood" attestation
    const checkForValuProofOfPersonhood = async () => {
      if (attestation && attestation.attestations_provisioned) {
        try {
          const attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
          if (attestationData) {
            // Check if any attestation has the name "Valu Proof of Personhood"
            const hasValuAttestation = Object.values(attestationData).some(attestationItem => 
              attestationItem && 
              typeof attestationItem === 'object' && 
              attestationItem.name === "Valu Proof of Personhood"
            );
            setHasValuProofOfPersonhood(hasValuAttestation);
          } else {
            setHasValuProofOfPersonhood(false);
          }
        } catch (e) {
          console.warn('Could not check attestations:', e.message);
          setHasValuProofOfPersonhood(false);
        }
      } else {
        setHasValuProofOfPersonhood(false);
      }
    };

    checkForValuProofOfPersonhood();
  }, [attestation]);

  const openService = (service) => {
    navigation.navigate("Service", { service });
  }
  
  const handleWidgetPress = useCallback((widgetType) => {
    if (widgetType === VALU_SOCIAL_WIDGET_TYPE) {
      setValuSocialModalVisible(true);
    } else if (widgetType === ATTESTATION_WIDGET_TYPE) {
      navigation.navigate('Service', {
        service: VALU_SERVICE_ID,
        subScreen: 'attestation'
      });
    } else if (widgetType === ADDRESS_BOOK_WIDGET_TYPE) {
      navigation.navigate('AddressBook');
    }
  }, [navigation]);

  return (
    <ServicesOverviewRender 
      activeAccount={activeAccount} 
      openService={openService}
      hasValuProofOfPersonhood={hasValuProofOfPersonhood}
      handleWidgetPress={handleWidgetPress}
      addressBookCount={addressBookAddresses.length}
      valuSocialModalVisible={valuSocialModalVisible}
      onCloseValuSocialModal={() => setValuSocialModalVisible(false)}
    />
  );
}

export default ServicesOverview;