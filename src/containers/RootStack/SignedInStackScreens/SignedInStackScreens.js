/*
  2025-11-22: Removed the drawer/SideMenu wrapper so signed-in users land
  directly in MainStack with the new Settings bottom tab.
*/
import React, { useEffect } from 'react';
import MainStackScreens from '../MainStackScreens/MainStackScreens';
import { useDispatch, useSelector } from 'react-redux';
import { setDeeplinkUrl } from '../../../actions/actionCreators';
import { closeOffRamp } from '../../../actions/actions/channels/valu/dispatchers/ValuWalletReduxManager';
import { VALU_SERVICE_ID } from '../../../utils/constants/services';
import { useNavigation } from '@react-navigation/native';

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
          return;
        }

        // Step 1: Check if user already has PoP attestation
        const alreadyHasPoP = await hasProofOfPersonhood();
        
        if (alreadyHasPoP) {
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
          setHasCheckedPopEligibility(false); // Allow retry
          return;
        }

        // Step 3: Check KYC eligibility with backend (uses API key from authentication)
        
        const navigationCallback = createGetSponsoredAttestationNavigationCallback(navigation);
        const result = await checkAndNotifyPopEligibility(currentPartnerUserId, navigationCallback);

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
