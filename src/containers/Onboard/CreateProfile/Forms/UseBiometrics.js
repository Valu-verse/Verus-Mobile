/*
  UseBiometrics screen:
  - 2026-01-26: Updated primary button to GradientButton and secondary button to match
    Unlock.js styling (light blue filled button).
*/
import React from 'react';
import {View, Dimensions, StyleSheet} from 'react-native';
import {Text, Paragraph, Button} from 'react-native-paper';
import Colors from '../../../../globals/colors';
import { canEnableBiometry } from '../../../../actions/actions/channels/dlight/dispatchers/AlertManager';
import { Biometrics } from '../../../../images/customIcons';
import GradientButton from '../../../../components/GradientButton';
import { SMALL_DEVICE_HEGHT } from '../../../../utils/constants/constants';

export default function UseBiometrics({ setUseBiometrics, navigation }) {
  const {height} = Dimensions.get('window');

  const next = async (useBiometrics) => {
    if (useBiometrics && await canEnableBiometry()) {
      setUseBiometrics(useBiometrics)
      navigation.navigate("CreateWallet")
    } else if (!useBiometrics) {
      setUseBiometrics(useBiometrics)
      navigation.navigate("CreateWallet")
    }
  }

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
        alignItems: 'center',
        backgroundColor: Colors.secondaryColor
      }}>
      {height >= SMALL_DEVICE_HEGHT && <Biometrics
        width={180}
        style={{ top: height / 2 - 260, position: 'absolute' }}
      />}
      <View
        style={{
          alignItems: 'center',
          position: 'absolute',
          top: height / 2 - 130,
        }}>
        <Text
          style={{
            textAlign: 'center',
            color: Colors.primaryColor,
            fontSize: 28,
            fontWeight: 'bold',
          }}>
          {"Biometric Authentication"}
        </Text>
        <Paragraph
          style={{
            textAlign: 'center',
            width: '60%',
            marginTop: 24
          }}>
          {"Sign into your profile with biometric authentication. You can always change this later."}
        </Paragraph>
      </View>
      <GradientButton
        onPress={() => next(true)}
        style={styles.primaryButton}
      >
        {"Enable"}
      </GradientButton>
      <Button
        mode="contained"
        onPress={() => next(false)}
        style={styles.secondaryButton}
        contentStyle={styles.secondaryButtonContent}
        labelStyle={styles.secondaryButtonLabel}
        buttonColor="#EBF6FF"
        textColor={Colors.primaryColor}
      >
        {"Skip"}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    position: 'absolute',
    bottom: 96,
    width: 280,
  },
  secondaryButton: {
    position: 'absolute',
    bottom: 40,
    width: 280,
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: '#EBF6FF',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: {width: 0, height: 0},
  },
  secondaryButtonContent: {
    height: 48,
  },
  secondaryButtonLabel: {
    color: Colors.primaryColor,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'none',
    letterSpacing: -0.2,
  },
});
