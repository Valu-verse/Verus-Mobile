/*
  AddressBookWidget
  - Widget card for Services screen showing address book entry point
  - Displays count of saved addresses
  - Styled to match VerusIdWidget and AttestationWidget pattern
  - Created 2026-01-22
  - Updated 2026-01-22: Simplified to match gradient card pattern of other service widgets
*/

import React from 'react';
import { View, Dimensions, Text, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';

const AddressBookWidget = ({ addressCount = 0 }) => {
  const { width } = Dimensions.get('window');
  const containerWidth = width - 32;
  const containerHeight = 108;

  const subtitle = addressCount === 0 
    ? 'Save addresses for easy access' 
    : `${addressCount} saved address${addressCount !== 1 ? 'es' : ''}`;

  return (
    <View style={[styles.container, { minHeight: containerHeight }]}> 
      <View style={styles.background} pointerEvents="none">
        <Svg width={containerWidth} height={containerHeight}>
          <Defs>
            <SvgLinearGradient id="addressBookGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.6" stopColor="#F8F8F8" />
              <Stop offset="1" stopColor="#F2F2F2" />
            </SvgLinearGradient>
            <SvgRadialGradient id="addressBookHighlight" cx="0.92" cy="0.88" r="0.85">
              <Stop offset="0" stopColor="#3165D4" stopOpacity="0.18" />
              <Stop offset="0.6" stopColor="#3165D4" stopOpacity="0.08" />
              <Stop offset="1" stopColor="#3165D4" stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>
          <Rect x={0} y={0} width={containerWidth} height={containerHeight} fill="url(#addressBookGradient)" rx={16} ry={16} />
          <Rect x={0} y={0} width={containerWidth} height={containerHeight} fill="url(#addressBookHighlight)" rx={16} ry={16} />
        </Svg>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Address Book</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
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
    backgroundColor: '#F8F8F8',
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
    color: '#3165D4',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 2,
  },
});

export default AddressBookWidget;
