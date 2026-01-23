/*
  AttestationWidget
  2025-11-04: Full-width Valu gradient block without card chrome.
  2026-01-23: Added subtitle "Prove you're human, on-chain" for additional context.
*/
import React from 'react';
import { View, Dimensions, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

const AttestationWidget = ({ hasValuProofOfPersonhood }) => {
  const { width } = Dimensions.get('window');
  const containerWidth = width - 32;
  const containerHeight = 108;

  const widgetText = hasValuProofOfPersonhood
    ? 'View my Proof of Personhood'
    : 'Get your Proof of Personhood';

  return (
    <View style={[styles.container, { minHeight: containerHeight }]}> 
      <View style={styles.background} pointerEvents="none">
        <Svg width={containerWidth} height={containerHeight}>
          <Defs>
            <SvgLinearGradient id="valuGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#00C8FF" />
              <Stop offset="1" stopColor="#0077A9" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={containerWidth} height={containerHeight} fill="url(#valuGradient)" rx={16} ry={16} />
        </Svg>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{widgetText}</Text>
        <Text style={styles.subtitle}>Prove you're human, on-chain</Text>
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
    backgroundColor: '#0077A9',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
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

export default AttestationWidget;
