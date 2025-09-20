/*
  This component's purpose is to present the user with the option
  to log into their accounts, and will only be shown if at least on account
  exists on the mobile device. It uses the user-entered username and password
  to find and decrypt the wallet seed in asyncStorage. When mounted, it clears
  any detecting app update heartbeats located from before, and upon successfull
  login, creates a new update heartbeat interval.
*/

/*
  Updated Login screen to match Landing screen visual style:
  - Added top blue blob with "Powered by" and white Verus logo
  - Centered Valu logo with welcome copy below
  - Preserved existing Login and Add a profile buttons
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
        labelStyle={{fontWeight: 'bold'}}
        style={{
          position: 'absolute',
          bottom: 86, // Adjusted position
          width: 280,
        }}>
        {'Login'}
      </TallButton>
      <TallButton
        onPress={() => handleAddUser()}
        mode="text"
        labelStyle={{fontWeight: 'bold'}}
        style={{
          position: 'absolute',
          bottom: 30, // Adjusted position
          width: 280,
        }}>
        {'Add a profile'}
      </TallButton>
    </SafeAreaView>
  );
};

export default Login;
