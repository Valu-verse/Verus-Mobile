/*
  Updated CreatePassword screen:
  - Single password input (no confirm) with inline strength bars (5 stripes)
  - Uses existing scorePassword() backend for scoring; UI only changed
  - Styling aligned with ChooseName (top-left title, custom input)
  - Continue navigates to ConfirmPassword
  - 2026-01-26: Updated input field and primary button to match Unlock.js styling pattern
    (soft background with focus border/shadow, GradientButton for primary CTA).
*/
import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput as RNTextInput,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import {Text} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {createAlert} from '../../../../actions/actions/alert/dispatchers/alert';
import GradientButton from '../../../../components/GradientButton';
import Colors from '../../../../globals/colors';
import scorePassword from '../../../../utils/auth/scorePassword';
import { MIN_PASS_LENGTH, MIN_PASS_SCORE, PASS_SCORE_LIMIT, SMALL_DEVICE_HEGHT } from '../../../../utils/constants/constants';

export default function CreatePassword({password, setPassword, navigation}) {
  const {height} = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  const [pwd, setPwd] = useState('');
  const [score, setScore] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  
  useEffect(() => {
    if (!pwd) setScore(0)
    else setScore(scorePassword(pwd, MIN_PASS_LENGTH, PASS_SCORE_LIMIT))
  }, [pwd])

  const level = useMemo(() => {
    if (!pwd) return 0;
    if (score < MIN_PASS_SCORE) return 2; // weak shows two red bars
    const span = PASS_SCORE_LIMIT - MIN_PASS_SCORE;
    const adjusted = Math.max(0, Math.min(1, (score - MIN_PASS_SCORE) / span));
    // Ensure MIN_PASS_SCORE starts at 3 bars; scale remaining 2 bars across the range
    return Math.min(5, 3 + Math.ceil(adjusted * 2)); // 3..5
  }, [pwd, score])

  const levelColor = useMemo(() => {
    if (level <= 2) return Colors.warningButtonColor
    if (level === 3) return Colors.infoButtonColor
    if (level === 4) return Colors.primaryColor
    return Colors.verusGreenColor
  }, [level])

  const strengthLabel = useMemo(() => {
    if (!pwd) return 'strength';
    if (level <= 2) return 'weak';
    if (level === 3) return 'mediocre';
    if (level === 4) return 'good';
    return 'excellent';
  }, [pwd, level])

  const validate = () => {
    const res = {valid: false, message: ''};

    if (!pwd || pwd.length < 1) {
      res.message = 'Please enter a password.';
      return res;
    } else if (score < MIN_PASS_SCORE) {
      res.message = 'Please enter a stronger password.';
      return res;
    }

    res.valid = true;
    return res;
  };

  const next = async () => {
    const {valid, message} = validate();

    if (!valid) {
      createAlert('Error', message);
    } else {
      setPassword(pwd);
      navigation.navigate('ConfirmPassword');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.secondaryColor }}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={{ flex: 1, backgroundColor: Colors.secondaryColor, paddingHorizontal: 24, paddingTop: height < SMALL_DEVICE_HEGHT ? 40 : 60 }}>
          <Text style={{ textAlign: 'left', color: '#1A1A1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 12 }}>{'Create password'}</Text>
          <Text style={{ textAlign: 'left', fontSize: 16, lineHeight: 22, color: '#555', marginBottom: 16 }}>{'This password encrypts your wallet in this profile.'}</Text>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 }}>{'Password'}</Text>
            <View
              style={[
                styles.inputContainer,
                isFocused && styles.inputContainerFocused,
              ]}
            >
              <RNTextInput
                value={pwd}
                onChangeText={setPwd}
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
            {/* Strength bars */}
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              {[0,1,2,3,4].map((i) => (
                <View key={i} style={{
                  height: 6,
                  flex: 1,
                  marginRight: i < 4 ? 6 : 0,
                  borderRadius: 3,
                  backgroundColor: i < level ? levelColor : '#E0E0E0'
                }} />
              ))}
            </View>
            {pwd ? (
              <Text style={{ marginTop: 6, fontSize: 12, color: '#666' }}>{`Strength: ${strengthLabel}`}</Text>
            ) : null}
          </View>

          <View style={{ flex: 1 }} />

          <GradientButton
            onPress={next}
            disabled={!pwd || score < MIN_PASS_SCORE}
            style={[styles.continueButton, { marginBottom: Math.max(24, insets.bottom + 16) }]}
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
