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
  const navigation = useNavigation();
  const dispatch = useDispatch()

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

  return <MainStackScreens {...props} />;
};

export default SignedInStackScreens;