/*
  Updated ChooseName screen:
  - Top-aligned layout with left-aligned title (black)
  - Improved typography and spacing for body copy
  - Custom text input with modern styling (larger, cleaner)
  - Primary button matches Login.js style (no shadow, proper colors)
  - Better spacing between "How it works" link and Continue button
  - Added "How it works" modal using SemiModal pattern
  - Removed on-page bullet points; moved note about multiple profiles into modal
  - 2026-01-12: Standardized sheet close affordance to shared SemiModal header (top-right X).
  - 2026-01-26: Updated input field and primary button to match Unlock.js styling pattern
    (soft background with focus border/shadow, GradientButton for primary CTA).
*/
import React, { useState } from 'react';
import {View, Dimensions, TouchableWithoutFeedback, Keyboard, TouchableOpacity, TextInput as RNTextInput, SafeAreaView, StyleSheet} from 'react-native';
import {Text, Portal} from 'react-native-paper';
import { createAlert } from '../../../../actions/actions/alert/dispatchers/alert';
import GradientButton from '../../../../components/GradientButton';
import Colors from '../../../../globals/colors';
import { SMALL_DEVICE_HEGHT } from '../../../../utils/constants/constants';
import { useObjectSelector } from '../../../../hooks/useObjectSelector';
import SemiModal from '../../../../components/SemiModal';

export default function ChooseName({ profileName, setProfileName, navigation }) {
  const {height} = Dimensions.get('window');
  const accounts = useObjectSelector(state => state.authentication.accounts)
  const [howItWorksVisible, setHowItWorksVisible] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const isDuplicateAccount = (accountID) => {
    let index = 0;

    while (
      index < accounts.length &&
      accountID !== accounts[index].id
    ) {
      index++;
    }

    if (index < accounts.length) {
      return true;
    } else {
      return false;
    }
  };

  const validate = () => {
    const res = { valid: false, message: "" }

    if (!profileName || profileName.length < 1) {
      res.message = "Please enter a profile name."
      return res
    } else if (profileName.length > 50) {
      res.message = "Please enter a profile name shorter than 50 characters."
      return res
    } else if (isDuplicateAccount(profileName)) {
      res.message = "A profile with this name already exists."
      return res
    }

    res.valid = true
    return res
  }

  const next = () => {
    const { valid, message } = validate()

    if (!valid) createAlert("Error", message)
    else navigation.navigate("CreatePassword")
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.secondaryColor }}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.secondaryColor,
            paddingHorizontal: 24,
            paddingTop: height < SMALL_DEVICE_HEGHT ? 40 : 60,
          }}>
          
          {/* Title - top-aligned, left-aligned, black */}
          <Text
            style={{
              textAlign: 'left',
              color: '#1A1A1A',
              fontSize: 32,
              fontWeight: '700',
              letterSpacing: -0.5,
              marginBottom: 12,
            }}>
            {"Name your profile"}
          </Text>

          {/* Subtitle - left-aligned, improved typography */}
          <Text
            style={{
              textAlign: 'left',
              fontSize: 16,
              lineHeight: 22,
              color: '#555',
              marginBottom: 16,
            }}>
            {"Let's start by creating a profile. Your wallet lives inside a profile on this device."}
          </Text>

          {/* Spacer after body copy */}
          <View style={{ marginBottom: 32 }} />

          {/* Custom text input - matches Unlock.js pattern */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 }}>
              {"Profile name"}
            </Text>
            <View
              style={[
                styles.inputContainer,
                isFocused && styles.inputContainerFocused,
              ]}
            >
              <RNTextInput
                value={profileName}
                onChangeText={setProfileName}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="e.g., Personal, Savings, Trading"
                placeholderTextColor="#999"
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                onSubmitEditing={next}
                style={styles.input}
              />
            </View>
            <Text
              style={{
                textAlign: 'left',
                marginTop: 8,
                fontSize: 12,
                color: '#888'
              }}
            >
              {"1–50 characters. Avoid sensitive info."}
            </Text>
          </View>

          {/* Spacer to push bottom elements down */}
          <View style={{ flex: 1 }} />

          {/* How it works link - more spacing above button */}
          <TouchableOpacity
            onPress={() => setHowItWorksVisible(true)}
            activeOpacity={0.7}
            style={{ marginBottom: 20, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 14, color: '#666', textDecorationLine: 'underline' }}>
              {'How it works'}
            </Text>
          </TouchableOpacity>

          {/* Continue button - matches Unlock.js GradientButton style */}
          <GradientButton
            onPress={next}
            disabled={profileName.length === 0}
            style={styles.continueButton}
          >
            {"Continue"}
          </GradientButton>

          {/* How it works modal */}
          <Portal>
            <SemiModal
              animationType={'slide'}
              transparent={true}
              visible={howItWorksVisible}
              onRequestClose={() => setHowItWorksVisible(false)}
              title="How it works"
              flexHeight={0.01}
              contentContainerStyle={{
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                flex: 0,
                alignSelf: 'flex-end',
                width: '100%',
                maxHeight: '70%'
              }}
            >
              <View>
                <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: 'black' }}>1</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>Choose a profile name. Your wallet will live inside this profile.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: 'black' }}>2</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>Set a password to encrypt your wallet on this device. You can enable biometrics for quicker unlock.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: 'black' }}>3</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>Import an existing seed or create a new wallet inside the profile.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: 'black' }}>4</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>Your wallet's keys stay on your device. Nothing leaves without your consent.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: 'black' }}>5</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, flex: 1 }}>You can create multiple profiles to keep your wallets separate.</Text>
                  </View>
                  <GradientButton
                    onPress={() => setHowItWorksVisible(false)}
                    style={{ marginBottom: 8 }}
                  >
                    {'Got it'}
                  </GradientButton>
                </View>
              </View>
            </SemiModal>
          </Portal>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    height: 52,
  },
  inputContainerFocused: {
    backgroundColor: '#FFF',
    borderColor: Colors.primaryColor,
    shadowColor: Colors.primaryColor,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  continueButton: {
    marginBottom: 24,
  },
});