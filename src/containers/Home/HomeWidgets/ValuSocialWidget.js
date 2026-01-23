/*
  ValuSocialWidget
  2026-01-23: Created full-width card for Valu Social entry point on Services screen.
              Uses valusocial.png background with gradient overlay, styled to match
              other service widgets (AttestationWidget, AddressBookWidget pattern).
*/

import React from 'react';
import { View, Dimensions, Text, StyleSheet, Image } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';

const ValuSocialWidget = () => {
  const { width } = Dimensions.get('window');
  const containerWidth = width - 32;
  const containerHeight = 108;

  return (
    <View style={[styles.container, { minHeight: containerHeight }]}> 
      <View style={styles.background} pointerEvents="none">
        <Image
          source={require('../../../images/customIcons/valusocial.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <Svg 
          width={containerWidth} 
          height={containerHeight} 
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <SvgLinearGradient id="socialOverlay" x1="0" y1="0.3" x2="0" y2="1">
              <Stop offset="0" stopColor="black" stopOpacity="0" />
              <Stop offset="0.6" stopColor="black" stopOpacity="0.5" />
              <Stop offset="1" stopColor="black" stopOpacity="0.75" />
            </SvgLinearGradient>
          </Defs>
          <Rect 
            x={0} 
            y={0} 
            width={containerWidth} 
            height={containerHeight} 
            fill="url(#socialOverlay)" 
            rx={16} 
            ry={16} 
          />
        </Svg>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Immerse yourself in Valu Social</Text>
        <Text style={styles.subtitle}>Connect with the community</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 24,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
    backgroundColor: '#1a1a2e',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
});

export default ValuSocialWidget;
