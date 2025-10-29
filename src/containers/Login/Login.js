/*
  Login screen
  - Purpose: Presents login options when at least one account exists on device.
  - Behavior: Auth modal logic preserved; navigations unchanged.
  - Visual updates (this edit):
    • Primary button uses contained, rounded style with NO shadow/glow.
    • Themed secondary button (outlined, rounded) for "Create new profile".
    • Consistent typography (font size, weight, casing) and height.
  - Copy update (this edit):
    • Renamed secondary CTA from "Add a profile" to "Create new profile".
  - UI restore (this edit):
    • Reintroduced three-dot overflow menu (SignedOutDropdown) and repositioned it
      below the blue header on the right for safe tap target.
*/
import React, {useEffect} from 'react';
import {View, ScrollView, Dimensions, SafeAreaView, Image} from 'react-native';
import {Button, Text} from 'react-native-paper';
import Styles from '../../styles/index';
import Colors from '../../globals/colors';
import { ValuLogo } from '../../images/customIcons';
import VerusLogoWhite from '../../images/customIcons/verus-logo-white.svg';
import {TouchableOpacity} from 'react-native';
import {openAuthenticateUserModal} from '../../actions/actions/sendModal/dispatchers/sendModal';
import {
  SEND_MODAL_FORM_STEP_CONFIRM,
  SEND_MODAL_FORM_STEP_FORM,
  SEND_MODAL_USER_TO_AUTHENTICATE,
} from '../../utils/constants/sendModal';
import {useSelector} from 'react-redux';
import TallButton from '../../components/LargerButton';
import SignedOutDropdown from '../SignedOutDropdown/SignedOutDropdown';
import { useObjectSelector } from '../../hooks/useObjectSelector';

const {height} = Dimensions.get('window');

const Login = props => {
  const defaultAccount = useSelector(
    state => state.settings.generalWalletSettings.defaultAccount,
  );
  const authModalUsed = useSelector(
    state => state.authentication.authModalUsed,
  );
  const modalVisible = useSelector(
    state => state.sendModal.visible,
  );
  
  const accounts = useObjectSelector(state => state.authentication.accounts);
  const hasAccount = accounts != null && accounts.length > 0;

  openAuthModal = ignoreDefault => {
    if (ignoreDefault) {
      openAuthenticateUserModal();
    } else {
      openAuthenticateUserModal(
        {
          [SEND_MODAL_USER_TO_AUTHENTICATE]: defaultAccount,
        },
        defaultAccount != null &&
          !authModalUsed &&
          accounts.find(x => x.accountHash === defaultAccount) != null
          ? SEND_MODAL_FORM_STEP_CONFIRM
          : SEND_MODAL_FORM_STEP_FORM,
      );
    }
  };

  useEffect(() => {
    if (
      !authModalUsed &&
      defaultAccount != null &&
      accounts.find(x => x.accountHash === defaultAccount) != null
    ) {
      setTimeout(() => {
        openAuthModal();
      }, 700);
    }
  }, []);

  handleAddUser = () => {
    props.navigation.navigate('CreateProfile');
  };

  handleRevokeRecover = () => {
    props.navigation.navigate('RevokeRecover');
  }

  handleRecoverSeed = () => {
    props.navigation.navigate('RecoverSeeds');
  };

  handleRevokeRecover = () => {
    props.navigation.navigate('RevokeRecover');
  }

  handleRecoverSeed = () => {
    props.navigation.navigate('RecoverSeeds');
  };

  return (
    <SafeAreaView
      style={{
        backgroundColor: Colors.secondaryColor,
        ...Styles.focalCenter,
      }}>
      {/* Top Verus blob */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 160,
          backgroundColor: '#3165D4',
          borderBottomLeftRadius: 36,
          borderBottomRightRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 44,
        }}
      >
        <Text style={{ fontSize: 12, color: Colors.secondaryColor, opacity: 0.9, marginBottom: 6 }}>
          Powered by
        </Text>
        <VerusLogoWhite width={110} height={24} />
      </View>

      {/* Top-right overflow menu (placed just below the blue header) */}
      <View style={{ position: 'absolute', top: 168, right: 0, left: 0, zIndex: 20, paddingRight: 12 }}>
        <SignedOutDropdown
          hasAccount={hasAccount}
          handleRecoverSeed={handleRecoverSeed}
          handleRevokeRecover={handleRevokeRecover}
        />
      </View>

      {/* Center hero with Valu logo and copy */}
      <View style={{ alignItems: 'center' }}>
        <Image 
          source={ValuLogo} 
          style={{ width: 200, height: 120, resizeMode: 'contain' }}
        />
        <Text
          style={{
            textAlign: 'center',
            color: Colors.primaryColor,
            fontSize: 18,
            fontWeight: '600',
            marginTop: 24,
            lineHeight: 24,
          }}>
          Welcome to VALU.{'\n'}Make the most of every day.
        </Text>
      </View>
      <TallButton
        onPress={() => openAuthModal()}
        mode="contained"
        labelStyle={{ color: Colors.secondaryColor, fontWeight: '600', fontSize: 18, letterSpacing: 0, textTransform: 'none' }}
        uppercase={false}
        contentStyle={{ height: 56 }}
        style={{
          position: 'absolute',
          bottom: 100, // Add small spacing between buttons
          width: 300,
          borderRadius: 24,
          backgroundColor: Colors.primaryColor,
          elevation: 0,
          shadowColor: 'transparent',
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
        }}>
        {'Login'}
      </TallButton>
      <TallButton
        onPress={() => handleAddUser()}
        mode="outlined"
        labelStyle={{ color: Colors.primaryColor, fontWeight: '600', fontSize: 18, letterSpacing: 0, textTransform: 'none' }}
        uppercase={false}
        contentStyle={{ height: 56 }}
        style={{
          position: 'absolute',
          bottom: 30, // Adjusted position
          width: 300,
          borderRadius: 24,
          backgroundColor: Colors.secondaryColor,
          borderWidth: 1,
          borderColor: Colors.primaryColor,
        }}>
        {'Create new profile'}
      </TallButton>
    </SafeAreaView>
  );
};

export default Login;
