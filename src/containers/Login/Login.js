/*
  This component's purpose is to present the user with the option
  to log into their accounts, and will only be shown if at least on account
  exists on the mobile device. It uses the user-entered username and password
  to find and decrypt the wallet seed in asyncStorage. When mounted, it clears
  any detecting app update heartbeats located from before, and upon successfull
  login, creates a new update heartbeat interval.
*/

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, View, Dimensions, SafeAreaView} from 'react-native';
import {Text} from 'react-native-paper';
import Styles from '../../styles/index';
import Colors from '../../globals/colors';
import VerusLogoWhite from '../../images/customIcons/verus-logo-white.svg';
import {openAuthenticateUserModal} from '../../actions/actions/sendModal/dispatchers/sendModal';
import {
  SEND_MODAL_FORM_STEP_CONFIRM,
  SEND_MODAL_FORM_STEP_FORM,
  SEND_MODAL_USER_TO_AUTHENTICATE,
} from '../../utils/constants/sendModal';
import {useSelector} from 'react-redux';
import GradientButton from '../../components/GradientButton';
import SignedOutDropdown from '../SignedOutDropdown/SignedOutDropdown';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { selectHasAuthenticatedSession } from '../../selectors/authentication';
import {readDeeplinkFromNfc} from '../../actions/actionDispatchers';
import {
  clearPendingDeeplinkRequests,
  getPendingDeeplinkRequestCount,
} from '../../utils/deeplink/pendingDeeplinkStorage';

const ValuGlyph = require('../../images/customIcons/valu-icon.png');

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
  const hasAuthenticatedSession = useSelector(selectHasAuthenticatedSession);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const autoOpenTimeoutRef = useRef(null);

  const openAuthModal = ignoreDefault => {
    if (hasAuthenticatedSession) {
      return;
    }

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
    if (autoOpenTimeoutRef.current != null) {
      clearTimeout(autoOpenTimeoutRef.current);
      autoOpenTimeoutRef.current = null;
    }

    if (
      !hasAuthenticatedSession &&
      !authModalUsed &&
      defaultAccount != null &&
      accounts.find(x => x.accountHash === defaultAccount) != null
    ) {
      autoOpenTimeoutRef.current = setTimeout(() => {
        openAuthModal();
      }, 700);
    }

    return () => {
      if (autoOpenTimeoutRef.current != null) {
        clearTimeout(autoOpenTimeoutRef.current);
        autoOpenTimeoutRef.current = null;
      }
    };
  }, [accounts, authModalUsed, defaultAccount, hasAuthenticatedSession]);

  const handleAddUser = () => {
    props.navigation.navigate('CreateProfile');
  };

  const handleRevokeRecover = () => {
    props.navigation.navigate('RevokeRecover');
  };

  const handleRecoverSeed = () => {
    props.navigation.navigate('RecoverSeeds');
  };

  return (
    <SafeAreaView
      style={{
        backgroundColor: Colors.secondaryColor,
        ...Styles.focalCenter,
      }}>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          zIndex: 20,
          elevation: 20,
        }}>
        {!modalVisible && <SignedOutDropdown
          handleRecoverSeed={() => handleRecoverSeed()}
          handleRevokeRecover={() => handleRevokeRecover()}
          handlePendingRequests={() => handlePendingRequests()}
          handleClearPendingRequests={() => handleClearPendingRequests()}
          handleReadDeeplinkFromNfc={readDeeplinkFromNfc}
          pendingRequestCount={pendingRequestCount}
          hasAccount={true}
        />}
    <SafeAreaView style={styles.root}>
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
      <GradientButton
        onPress={() => openAuthModal()}
        mode="contained"
        style={styles.loginCta}
      >
        {'Login'}
      </GradientButton>
      <GradientButton
        onPress={() => handleAddUser()}
        mode="outlined"
        labelStyle={{ color: Colors.primaryColor, fontWeight: '600', fontSize: 16 }}
        style={styles.secondaryCta}
      >
        {'Create new profile'}
      </GradientButton>
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
    left: 20,
    right: 20,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  secondaryCta: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
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
