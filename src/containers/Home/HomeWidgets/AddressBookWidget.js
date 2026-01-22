/*
  AddressBookWidget
  - Widget card for Services screen showing address book entry point
  - Displays count of saved addresses
  - Styled to match VerusIdWidget pattern
  - Created 2026-01-22
*/

import React from 'react';
import { View, Dimensions, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
              <Stop offset="0" stopColor="#5B8DEF" stopOpacity="0.18" />
              <Stop offset="0.6" stopColor="#5B8DEF" stopOpacity="0.08" />
              <Stop offset="1" stopColor="#5B8DEF" stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>
          <Rect x={0} y={0} width={containerWidth} height={containerHeight} fill="url(#addressBookGradient)" rx={16} ry={16} />
          <Rect x={0} y={0} width={containerWidth} height={containerHeight} fill="url(#addressBookHighlight)" rx={16} ry={16} />
        </Svg>
      </View>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="book-account-outline" size={24} color="#5B8DEF" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Address Book</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color="#999" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(91, 141, 239, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
});

export default AddressBookWidget;
