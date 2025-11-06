/*
  Updated Login screen:
  - Added looping onboarding video backdrop and Valu glyph hero copy
  - Positioned "Powered by Verus" pill at the top-right above the signed-out menu
  - Preserved existing Login/Create profile CTA styles layered over the new design
  - Scope limited to this file; authentication flows unchanged
*/
import React, {useEffect} from 'react';
import {View, SafeAreaView, Image, StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';
import Video from 'react-native-video';
import Colors from '../../globals/colors';
import VerusLogoWhite from '../../images/customIcons/verus-logo-white.svg';
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

const ValuGlyph = require('../../images/customIcons/valu-icon.png');
const onboardingVideo = require('../../images/valu-onb-video1.mp4');

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
    <SafeAreaView style={styles.root}>
      <Video
        source={onboardingVideo}
        style={styles.video}
        resizeMode="cover"
        repeat
        muted
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="obey"
      />

      <View style={styles.topPills}>
        <View style={styles.poweredPill}>
          <Text style={styles.poweredText}>Powered by</Text>
          <VerusLogoWhite width={68} height={16} />
        </View>
        <SignedOutDropdown
          hasAccount={hasAccount}
          handleRecoverSeed={handleRecoverSeed}
          handleRevokeRecover={handleRevokeRecover}
        />
      </View>

      <View style={styles.overlay}>
        <View style={styles.copyWrap}>
          <Image source={ValuGlyph} style={styles.heroIcon} />
          <Text style={styles.headline}>
            Take control of what matters most — your value.
          </Text>
        </View>
      </View>
      <TallButton
        onPress={() => openAuthModal()}
        mode="contained"
        labelStyle={{ color: Colors.secondaryColor, fontWeight: '600', fontSize: 18, letterSpacing: 0, textTransform: 'none' }}
        uppercase={false}
        contentStyle={{ height: 56 }}
        style={styles.loginCta}>
        {'Login'}
      </TallButton>
      <TallButton
        onPress={() => handleAddUser()}
        mode="outlined"
        labelStyle={{ color: Colors.primaryColor, fontWeight: '600', fontSize: 18, letterSpacing: 0, textTransform: 'none' }}
        uppercase={false}
        contentStyle={{ height: 56 }}
        style={styles.secondaryCta}>
        {'Create new profile'}
      </TallButton>
    </SafeAreaView>
  );
};

export default Login;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.secondaryColor,
    justifyContent: 'center',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  topPills: {
    position: 'absolute',
    top: 68,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  poweredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(49, 101, 212, 0.95)',
    marginRight: 8,
  },
  poweredText: {
    color: Colors.secondaryColor,
    fontSize: 11.5,
    fontWeight: '600',
    marginRight: 8,
    letterSpacing: -0.2,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 250,
  },
  copyWrap: {
    maxWidth: 320,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
    marginBottom: 18,
  },
  headline: {
    color: Colors.quinaryColor,
    textAlign: 'left',
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 36,
  },
  loginCta: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: 300,
    borderRadius: 24,
    backgroundColor: Colors.primaryColor,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  secondaryCta: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 300,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 2,
    borderColor: Colors.primaryColor,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
});
