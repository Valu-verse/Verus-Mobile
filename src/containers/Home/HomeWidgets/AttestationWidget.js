/*
  AttestationWidget
  2025-11-04: Full-width Valu gradient block without card chrome.
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
      <Text style={styles.title}>{widgetText}</Text>
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});

export default AttestationWidget;
