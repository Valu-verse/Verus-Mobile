/*
  Updated WalletIntro screen:
  - Styling aligned with ChooseName/Landing/Login
  - Replaced icon with wallet hero image (png)
  - Updated CTA labels: "Create new wallet" and "I already have a wallet"
  - Primary button: contained, rounded, no shadow; Secondary: outlined style
*/
import React, { useState } from 'react';
import {View, Dimensions, TouchableOpacity, Image, SafeAreaView} from 'react-native';
import {Text, IconButton} from 'react-native-paper';
import { createAlert, resolveAlert } from '../../../actions/actions/alert/dispatchers/alert';
import TallButton from '../../../components/LargerButton';
import Colors from '../../../globals/colors';
import WalletHero from '../../../images/customIcons/wallet-image.png';
import ImportWalletSheet from '../Forms/ImportWallet/Forms/ImportSheet';
import { getKey } from '../../../utils/keyGenerator/keyGenerator';
import { SMALL_DEVICE_HEGHT } from '../../../utils/constants/constants';

export default function WalletIntro({ navigation, setNewSeed, setTestProfile, testProfile }) {
  const {height} = Dimensions.get('window');
  const isSmall = height <= SMALL_DEVICE_HEGHT;

  const [loading, setLoading] = useState(false)
  const [iconPressCount, setIconPressCount] = useState(0);
  const [importSheetVisible, setImportSheetVisible] = useState(false);

  const canEnableTestmode = () => {
    return createAlert(
      "Make this a test profile?",
      "Creating a test profile will set this profile to use testnet currencies.\n\nALL TESTNET COINS/CURRENCIES HAVE NO VALUE AND WILL DISAPPEAR WHENEVER THEIR NETWORK IS RESET.\n\nAre you sure you would like to create this profile as a test profile?",
      [
        {
          text: "No",
          onPress: () => resolveAlert(false),
          style: "cancel",
        },
        { text: "Yes", onPress: () => resolveAlert(true) },
      ],
      {
        cancelable: false,
      }
    )
  }

  const tryEnableTest = async () => {
    if (await canEnableTestmode()) {
      setTestProfile(true);
      createAlert(
        'Testnet profile set',
        'This profile will be created as a test profile, and will use testnet currencies.',
      );
    }
  }

  const disableTest = () => {
    setTestProfile(false);
    createAlert(
      'Mainnet profile set',
      'This profile will be created as a mainnet profile, and will use mainnet currencies.',
    );
  };

  const handleIconPress = () => {
    const newCount = iconPressCount + 1;
    setIconPressCount(newCount);

    if (newCount === 7 && !testProfile) {
      setIconPressCount(0);
      tryEnableTest()
    }
  };

  const createNewWallet = async function(cb = () => {}) {
    try {
      const newSeed = await getKey(256);

      setNewSeed(newSeed)
      navigation.navigate("CreateSeed")
      cb()
    } catch(e) {
      createAlert("Error", "Error generating seed words.")
      console.warn(e)
      cb()
    }
  }

  const createNewWalletSync = function() {
    setLoading(true)
    createNewWallet(() => setLoading(false))
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.secondaryColor }}>
      <View style={{ flex: 1, backgroundColor: Colors.secondaryColor, paddingHorizontal: 24, paddingTop: height < SMALL_DEVICE_HEGHT ? 40 : 60 }}>
        <TouchableOpacity
          onPress={testProfile ? disableTest : tryEnableTest}
          style={{ position: 'absolute', top: 12, right: 6 }}
        >
          <IconButton icon={testProfile ? "test-tube-off" : "test-tube"} iconColor={Colors.verusDarkGray} />
        </TouchableOpacity>

        {/* Hero image - larger and positioned closer to middle */}
        {height >= SMALL_DEVICE_HEGHT && (
          <View style={{ alignItems: 'center', marginTop: isSmall ? 24 : Math.min(80, Math.round(height * 0.12)), marginBottom: 32 }}>
            <Image
              source={WalletHero}
              style={{ width: isSmall ? 260 : 320, height: isSmall ? 190 : 230, resizeMode: 'contain' }}
            />
          </View>
        )}

        {/* Title & subtitle */}
        <Text style={{ textAlign: 'left', color: '#1A1A1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 12 }}>
          {testProfile ? 'Create your test wallet' : 'Create your wallet'}
        </Text>
        <Text style={{ textAlign: 'left', fontSize: 16, lineHeight: 22, color: '#555', marginBottom: 24 }}>
          {'Your wallet lives inside this profile. Create a new wallet or import one you already control.'}
        </Text>

        <View style={{ flex: 1 }} />

        {/* Primary and secondary CTAs (align with Login.js styles) */}
        <TallButton
          onPress={() => createNewWalletSync()}
          mode="contained"
          labelStyle={{ color: Colors.secondaryColor, fontWeight: '600', fontSize: 18, letterSpacing: 0, textTransform: 'none' }}
          contentStyle={{ height: 56 }}
          disabled={loading}
          style={{
            width: '100%',
            borderRadius: 24,
            backgroundColor: Colors.primaryColor,
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
            marginBottom: 16,
          }}
        >
          {'Create new wallet'}
        </TallButton>

        <TallButton
          onPress={() => setImportSheetVisible(true)}
          mode="outlined"
          labelStyle={{ color: Colors.primaryColor, fontWeight: '600', fontSize: 18, letterSpacing: 0, textTransform: 'none' }}
          contentStyle={{ height: 56 }}
          disabled={loading}
          style={{
            width: '100%',
            borderRadius: 24,
            backgroundColor: Colors.secondaryColor,
            borderWidth: 1,
            borderColor: Colors.primaryColor,
            marginBottom: 24,
          }}
        >
          {'I already have a wallet'}
        </TallButton>
        <ImportWalletSheet
          visible={importSheetVisible}
          onClose={() => setImportSheetVisible(false)}
          onSelect={(route) => {
            setImportSheetVisible(false);
            // Navigate to specific import screen directly; keep stack for sub-flows
            navigation.navigate('ImportWallet', { initialScreen: route, label: undefined });
          }}
        />
      </View>
    </SafeAreaView>
  );
}
