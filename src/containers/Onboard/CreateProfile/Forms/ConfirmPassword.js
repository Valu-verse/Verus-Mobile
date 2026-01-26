/*
  New ConfirmPassword screen:
  - Single confirm input to match password set in previous step
  - Styling aligned with ChooseName/CreatePassword
  - On success, proceeds to UseBiometrics or CreateWallet depending on availability
  - 2026-01-26: Updated input field and primary button to match Unlock.js styling pattern
    (soft background with focus border/shadow, GradientButton for primary CTA).
*/
import React, { useState } from 'react';
import { View, Dimensions, TouchableWithoutFeedback, Keyboard, TextInput as RNTextInput, SafeAreaView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Colors from '../../../../globals/colors';
import GradientButton from '../../../../components/GradientButton';
import { SMALL_DEVICE_HEGHT } from '../../../../utils/constants/constants';
import { getSupportedBiometryType } from '../../../../utils/keychain/keychain';
import { createAlert } from '../../../../actions/actions/alert/dispatchers/alert';

export default function ConfirmPassword({ password, navigation }) {
  const { height } = Dimensions.get('window');
  const [confirm, setConfirm] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const next = async () => {
    if (!confirm || confirm.length < 1) {
      createAlert('Error', 'Please confirm your password.');
      return;
    }

    if (confirm !== password) {
      createAlert('Error', 'Password and confirm password do not match.');
      return;
    }

    if ((await getSupportedBiometryType()).biometry) {
      navigation.navigate('UseBiometrics');
    } else {
      navigation.navigate('CreateWallet');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.secondaryColor }}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={{ flex: 1, backgroundColor: Colors.secondaryColor, paddingHorizontal: 24, paddingTop: height < SMALL_DEVICE_HEGHT ? 40 : 60 }}>
          <Text style={{ textAlign: 'left', color: '#1A1A1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 12 }}>{'Confirm password'}</Text>
          <Text style={{ textAlign: 'left', fontSize: 16, lineHeight: 22, color: '#555', marginBottom: 16 }}>{'Re-enter your password to continue.'}</Text>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 }}>{'Password'}</Text>
            <View
              style={[
                styles.inputContainer,
                isFocused && styles.inputContainerFocused,
              ]}
            >
              <RNTextInput
                value={confirm}
                onChangeText={setConfirm}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={'Enter password'}
                placeholderTextColor={'#999'}
                returnKeyType={'done'}
                autoCapitalize={'none'}
                autoCorrect={false}
                spellCheck={false}
                secureTextEntry={true}
                onSubmitEditing={next}
                style={styles.input}
              />
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <GradientButton
            onPress={next}
            disabled={!confirm || confirm !== password}
            style={styles.continueButton}
          >
            {'Continue'}
          </GradientButton>
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
