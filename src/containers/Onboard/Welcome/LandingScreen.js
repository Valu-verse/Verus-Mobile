/*
  Updated LandingScreen:
  - Added looping muted background video for onboarding hero
  - Refined "Powered by Verus" pill placement/sizing for top-right alignment
  - Introduced refreshed VALU glyph PNG above headline copy with updated messaging
  - Softened primary CTA to a translucent pill and added inline policy disclaimer below it
  - Kept changes contained to this file
*/
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text } from 'react-native-paper';
import Video from 'react-native-video';
import TallButton from '../../../components/LargerButton';
import Colors from '../../../globals/colors';
import VerusLogoWhite from '../../../images/customIcons/verus-logo-white.svg';

const ValuGlyph = require('../../../images/customIcons/valu-icon.png');

const onboardingVideo = require('../../../images/valu-onb-video1.mp4');

export default function LandingScreen(props) {
  return (
    <View style={styles.root}>
      <Video
        source={onboardingVideo}
        style={styles.video}
        resizeMode="cover"
        repeat
        muted
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="obey"
      />

      <View style={styles.poweredPill}>
        <Text style={styles.poweredText}>Powered by</Text>
        <VerusLogoWhite width={68} height={16} />
      </View>

      <View style={styles.overlay}>
        <View style={styles.copyWrap}>
          <Image source={ValuGlyph} style={styles.heroIcon} />
          <Text style={styles.headline}>
            Take control of what matters most — your value.
          </Text>
        </View>
      </View>

      <View style={styles.footerBlock}>
        <Text style={styles.policyCopy}>
          By continuing you agree to our{' '}
          <Text style={styles.policyLink} onPress={() => null}>
            Terms
          </Text>{' '}
          and{' '}
          <Text style={styles.policyLink} onPress={() => null}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      <TallButton
        onPress={() => props.navigation.navigate('CreateProfile')}
        mode="contained"
        labelStyle={{
          color: Colors.primaryColor,
          fontWeight: '600',
          fontSize: 18,
          letterSpacing: 0,
          textTransform: 'none',
        }}
        uppercase={false}
        contentStyle={{ height: 56 }}
        style={styles.primaryCta}
      >
        {"Get started"}
      </TallButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.secondaryColor,
    justifyContent: 'center',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  poweredPill: {
    position: 'absolute',
    top: 68,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(49, 101, 212, 0.95)',
    zIndex: 2,
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
  footerBlock: {
    position: 'absolute',
    bottom: 72,
    width: '100%',
    alignItems: 'center',
  },
  policyCopy: {
    color: Colors.quinaryColor,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    maxWidth: 320,
    textAlign: 'center',
  },
  policyLink: {
    color: Colors.quinaryColor,
    fontWeight: '600',
  },
  primaryCta: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    width: 300,
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
