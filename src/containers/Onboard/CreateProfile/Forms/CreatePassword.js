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

const passwordAutofillProps = {
  autoComplete: 'off',
  importantForAutofill: 'no',
  textContentType: 'none',
};

export default function CreatePassword({password, setPassword, navigation}) {
  const {height} = Dimensions.get('window');

  const [firstBox, setFirstBox] = useState('');
  const [secondBox, setSecondBox] = useState('');
  const [passwordAffixDetails, setPasswordAffixDetails] = useState({
    text: "strength",
    color: Colors.tertiaryColor
  });
  
  useEffect(() => {
    calculatePasswordAffix()
  }, [firstBox])

  const calculatePasswordAffix = () => {
    if (!firstBox) {
      setPasswordAffixDetails({
        text: "strength",
        color: Colors.tertiaryColor
      })
    } else {
      const passScore = scorePassword(firstBox, MIN_PASS_LENGTH, PASS_SCORE_LIMIT);

      if (passScore < MIN_PASS_SCORE) {
        setPasswordAffixDetails({
          text: "weak",
          color: Colors.warningButtonColor
        })
      } else if (passScore < PASS_SCORE_LIMIT - ((PASS_SCORE_LIMIT - MIN_PASS_SCORE) / 2)) {
        setPasswordAffixDetails({
          text: "mediocre",
          color: Colors.infoButtonColor
        })
      } else {
        setPasswordAffixDetails({
          text: "strong",
          color: Colors.verusGreenColor
        })
      }
    }
  }

  const validate = () => {
    const res = {valid: false, message: ''};

    if (!pwd || pwd.length < 1) {
      res.message = 'Please enter a password.';
      return res;
    } else if (firstBox !== secondBox) {
      res.message = 'Password and confirm password do not match.';
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
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <View
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          alignItems: 'center',
          backgroundColor: Colors.secondaryColor,
        }}>
        <View
          style={{
            alignItems: 'center',
            position: 'absolute',
            top: height < SMALL_DEVICE_HEGHT ? 60 : height / 2 - 250,
          }}>
          <Text
            style={{
              textAlign: 'center',
              color: Colors.primaryColor,
              fontSize: 28,
              fontWeight: 'bold',
            }}>
            {'Create Password'}
          </Text>
          <Paragraph
            style={{
              textAlign: 'center',
              width: '75%',
              marginTop: 24,
              width: 280,
            }}>
            {
              'Create a secure password for your profile. Your password will be used to encrypt your wallet.'
            }
          </Paragraph>
          <TextInput
            returnKeyType="done"
            label="Create password"
            value={firstBox}
            mode={'outlined'}
            style={{
              width: '75%',
              marginTop: 24,
              width: 280,
            }}
            placeholder="Enter password"
            dense={true}
            onChangeText={text => setFirstBox(text)}
            autoCapitalize={'none'}
            autoCorrect={false}
            {...passwordAutofillProps}
            secureTextEntry={true}
            right={<TextInput.Affix text={passwordAffixDetails.text} textStyle={{color: passwordAffixDetails.color}}/>}
          />
          <TextInput
            returnKeyType="done"
            label="Confirm password"
            value={secondBox}
            mode={'outlined'}
            style={{
              width: '75%',
              marginTop: 8,
              width: 280,
            }}
            placeholder="Enter password"
            dense={true}
            onChangeText={text => setSecondBox(text)}
            autoCapitalize={'none'}
            autoCorrect={false}
            {...passwordAutofillProps}
            secureTextEntry={true}
          />
        </View>
        <TallButton
          onPress={next}
          mode="contained"
          labelStyle={{fontWeight: 'bold'}}
          disabled={firstBox.length == 0 || secondBox.length == 0}
          style={{
            position: 'absolute',
            bottom: 80,
            width: 280,
          }}>
          {'Next'}
        </TallButton>
      </View>
    </TouchableWithoutFeedback>
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
