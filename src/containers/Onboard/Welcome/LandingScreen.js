/*
  Updated LandingScreen:
  - Uses a looping muted background video behind a single live landing UI.
*/
import React from 'react';
import { SafeAreaView, View, StyleSheet, Image } from 'react-native';
import { Text } from 'react-native-paper';
import Video from 'react-native-video';
import GradientButton from '../../../components/GradientButton';
import Colors from '../../../globals/colors';
import VerusLogoWhite from '../../../images/customIcons/verus-logo-white.svg';

const ValuGlyph = require('../../../images/customIcons/valu-icon.png');
const OnboardingVideo = require('../../../images/valu-onb-video1.mp4');

export default function LandingScreen(props) {
  return (
    <SafeAreaView style={styles.root}>
      <Video
        source={OnboardingVideo}
        style={styles.backgroundVideo}
        resizeMode="cover"
        repeat
        muted
        playInBackground={false}
        playWhenInactive={false}
        disableFocus
      />

      <View style={styles.poweredPill}>
        <Text style={styles.poweredText}>Powered by</Text>
        <VerusLogoWhite width={68} height={16} />
      </View>

      <View style={styles.content}>
        <View style={styles.copyWrap}>
          <Image source={ValuGlyph} style={styles.heroIcon} />
          <Text style={styles.headline}>
            Take control of what matters most — your value.
          </Text>
        </View>
      </View>

      <View style={styles.footerBlock}>
        <GradientButton
          onPress={() => props.navigation.navigate('CreateProfile')}
          style={styles.primaryCta}
        >
          {'Get started'}
        </GradientButton>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFFFFF',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  poweredPill: {
    position: 'absolute',
    top: 48,
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 72,
  },
  copyWrap: {
    maxWidth: 320,
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
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'stretch',
  },
  policyCopy: {
    color: Colors.quinaryColor,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    maxWidth: 320,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 14,
  },
  policyLink: {
    color: Colors.quinaryColor,
    fontWeight: '600',
  },
  primaryCta: {
    width: '100%',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
});
