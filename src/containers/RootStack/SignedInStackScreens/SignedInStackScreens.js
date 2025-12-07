import React, { useEffect, useState } from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import SideMenu from '../../SideMenu/SideMenu';
import MainStackScreens from '../MainStackScreens/MainStackScreens';
import { useDispatch, useSelector } from 'react-redux';
import { setDeeplinkUrl } from '../../../actions/actionCreators';
import { closeOffRamp } from '../../../actions/actions/channels/valu/dispatchers/ValuWalletReduxManager';
import { VALU_SERVICE_ID } from '../../../utils/constants/services';
import { useNavigation } from '@react-navigation/native';
import { hasProofOfPersonhood, checkAndNotifyPopEligibility, createGetSponsoredAttestationNavigationCallback } from '../../../utils/pop/popNotificationHelper';

const MainDrawer = createDrawerNavigator()

const SignedInStackScreens = props => {
  const deeplinkId = useSelector((state) => state.deeplink.id)
  const deeplinkUrl = useSelector((state) => state.deeplink.url)
  const offRampRequest = useSelector((state) => state.channelStore_valu_service.offRampRequest)
  const openOffRamp = useSelector((state) => state.channelStore_valu_service.openOffRamp)
  const partnerUserId = useSelector((state) => state.channelStore_valu_service.partnerUserId)
  const notifications = useSelector((state) => state.notifications)
  const activeAccount = useSelector((state) => state.authentication.activeAccount)
  const acchash = activeAccount?.accountHash
  const navigation = useNavigation();
  const dispatch = useDispatch()
  const [hasCheckedPopEligibility, setHasCheckedPopEligibility] = useState(false);

  useEffect(() => {
    if (deeplinkId != null && deeplinkUrl != null) {    
      dispatch(setDeeplinkUrl(null))  
      props.navigation.navigate('DeepLink');
    }
  }, [deeplinkId, deeplinkUrl]);
  
  useEffect(() => {
    if (!!offRampRequest && openOffRamp) {
      closeOffRamp();
      new Promise(resolve => setTimeout(resolve, 3000))
        .then(() => {
          console.log(" props.navigation.navigate('Service',");
          navigation.navigate('Service', {
            service: VALU_SERVICE_ID,
            subScreen: 'ValuOffRampReview'
          });
        });
    }
  }, [offRampRequest, openOffRamp]);


  // Consolidated PoP eligibility check - runs once when component mounts
  useEffect(() => {
    const checkPopEligibilityFlow = async () => {
      // Skip if user is not signed in (account hash is null)
      if (!acchash) {
        console.log('No active account - skipping PoP eligibility check');
        return;
      }

      // Only run once
      if (hasCheckedPopEligibility) {
        return;
      }

      setHasCheckedPopEligibility(true);

      try {
        // Check if PoP notification already exists
        const popNotificationExists = notifications.directory && Object.values(notifications.directory).some(
          (notif) => notif.acchash === acchash && notif.title === "Proof of Personhood Available"
        );

        if (popNotificationExists) {
          console.log('PoP notification already exists - skipping eligibility check');
          return;
        }

        // Step 1: Check if user already has PoP attestation
        console.log('Checking if user already has Proof of Personhood...');
        const alreadyHasPoP = await hasProofOfPersonhood();
        
        if (alreadyHasPoP) {
          console.log('User already has PoP - skipping eligibility check');
          return;
        }

        // Step 2: Wait for Valu service to be initialized (happens in authentication saga)
        // We need to wait a bit for the saga to complete
        let currentPartnerUserId = partnerUserId;
        let retries = 0;
        while (currentPartnerUserId == undefined && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          // Re-read from store
          const state = navigation.getState();
          // Note: This is a simple wait - in production you might want to use a more robust approach
          retries++;
        }
        
        // If still undefined after waiting, skip
        if (currentPartnerUserId == undefined) {
          console.log('Valu service not initialized yet, will retry on next mount');
          setHasCheckedPopEligibility(false); // Allow retry
          return;
        }

        // Step 3: Check KYC eligibility with backend (uses API key from authentication)
        console.log('Checking PoP eligibility with backend...');
        const navigationCallback = createGetSponsoredAttestationNavigationCallback(navigation);
        const result = await checkAndNotifyPopEligibility(currentPartnerUserId, navigationCallback);
        
        if (result.notificationCreated) {
          console.log('PoP notification created - user is eligible and has completed KYC');
        } else {
          console.log('No PoP notification created:', result.reason);
        }
      } catch (error) {
        console.error('Error in PoP eligibility flow:', error);
      }
    };

    checkPopEligibilityFlow();
  }, [hasCheckedPopEligibility, partnerUserId, navigation, notifications, acchash]);

  return (
    <MainDrawer.Navigator
      drawerWidth={250}
      drawerContent={props => <SideMenu {...props} />}
      screenOptions={{
        swipeEnabled: false,
        headerShown: false,
        drawerPosition: "right"
      }}>
      <MainDrawer.Screen name="MainStack" component={MainStackScreens} />
    </MainDrawer.Navigator>
  );
};

export default SignedInStackScreens;
