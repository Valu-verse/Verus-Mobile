import React from 'react';
import { View, Dimensions, Image } from 'react-native';
import { Text, Paragraph } from 'react-native-paper';
import TallButton from '../../../components/LargerButton';
import Colors from '../../../globals/colors';
import { VerusLogo, ValuLogo } from '../../../images/customIcons';
import styles from '../../../styles';
import { SMALL_DEVICE_HEGHT } from '../../../utils/constants/constants';
import { useState } from 'react';
import { useEffect } from 'react';
import Styles from "../../../styles/index";

export default function LandingScreen(props) {
  const { height } = Dimensions.get('window');

  const [normalDevice, setNormalDevice] = useState(height > SMALL_DEVICE_HEGHT ? true : false);

  useEffect(() => {
    if (height > SMALL_DEVICE_HEGHT) {
      setNormalDevice(true);
    } else {
      setNormalDevice(false);
    }
  })

  const [normalDevice, setNormalDevice] = useState(height > SMALL_DEVICE_HEGHT ? true : false);

  useEffect(() => {
    if (height > SMALL_DEVICE_HEGHT) {
      setNormalDevice(true);
    } else {
      setNormalDevice(false);
    }
  })

  return (
    <View
      style={{
        backgroundColor: Colors.secondaryColor,
        ...styles.focalCenter,
      }}>
      <View style={{ alignItems: 'center', position: "absolute" }}>
        <Text
          style={{
            textAlign: 'center',
            color: Colors.primaryColor,
            fontSize: 28,
            fontWeight: 'bold',
          }}>
          {'Welcome to'}
        </Text>
        <Image source={ValuLogo} style={{
          width: '60%',
          height: '60%',
          resizeMode: 'contain',
        }} />
        <Text
          style={{
            textAlign: 'center',
            color: Colors.primaryColor,
            fontSize: 20
          }}>
          {''}
        </Text>
        {normalDevice ? <Paragraph
          style={{
            textAlign: 'center',
            width: "60%",
            marginTop: 24
          }}>
          {'The mobile wallet for Verus and its ecosystem.\nHere you can easily and securely send, receive and store VRSC, BTC, ETH and more.'}
        </Paragraph> : null}
      </View>
      <TallButton
        onPress={() => props.navigation.navigate("WelcomeSlider")}
        mode="contained"
        labelStyle={{ fontWeight: "bold" }}
        style={{
          position: "absolute",
          bottom: 80,
          width: 280
        }}>
        {"Get Started"}
      </TallButton>
    </View>
  );
}
