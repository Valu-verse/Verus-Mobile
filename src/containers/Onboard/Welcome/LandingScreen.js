/*
  Updated LandingScreen:
  - Added top blue blob with "Powered by Verus" branding
  - Removed animated background; clean minimal design
  - Added welcome copy under the Valu logo
  - Removed glow/shadow from primary button (flat appearance)
  - "Get started" now navigates directly to CreateProfile (skips WelcomeSlider)
  - Hid WelcomeSlider from the primary flow; route remains available if needed
  - Kept changes contained to this file
*/
import React from 'react';
import { View, Image } from 'react-native';
import { Text } from 'react-native-paper';
import TallButton from '../../../components/LargerButton';
import Colors from '../../../globals/colors';
import { ValuLogo } from '../../../images/customIcons';
import VerusLogoWhite from '../../../images/customIcons/verus-logo-white.svg';
import Styles from "../../../styles/index";

export default function LandingScreen(props) {
  return (
    <View
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
          style={{
            width: 180,
            height: 120,
            resizeMode: 'contain',
          }}
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
        onPress={() => props.navigation.navigate("CreateProfile")}
        mode="contained"
        labelStyle={{
          color: Colors.secondaryColor,
          fontWeight: '600',
          fontSize: 18,
          letterSpacing: 0,
          textTransform: 'none',
        }}
        uppercase={false}
        contentStyle={{ height: 56 }}
        style={{
          position: "absolute",
          bottom: 80,
          width: 300,
          borderRadius: 24,
          backgroundColor: Colors.primaryColor,
          elevation: 0,
          shadowColor: 'transparent',
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
        }}>
        {"Get started"}
      </TallButton>
    </View>
  );
}
