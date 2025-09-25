import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';

/*
  Updated file: NumericKeypad
  - Provides a reusable custom numeric keypad for amount entry
  - Keeps business logic outside; emits sanitized string values via onChange
  - Added configurable sizing and styling props for modern layouts
  - Full-width keypad layout with flex-based button sizing
  - Enhanced typography with medium font weight
*/

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

const NumericKeypad = ({
  value,
  onChange,
  decimalPlaces = 2,
  maxLength = 18,
  disabled = false,
  keyWidth = undefined,
  keyHeight = 44,
  fontSize = 20,
  keyRadius = 10,
  keyBackground = '#F2F2F2',
  containerPaddingHorizontal = 0,
  rowSpacing = 8,
}) => {
  const handlePress = (key) => {
    if (disabled) return;

    let next = value || '';
    if (key === '⌫') {
      next = next.slice(0, -1);
    } else if (key === '.') {
      if (!next.includes('.')) next = next.length === 0 ? '0.' : `${next}.`;
    } else {
      // digit
      if (next.length >= maxLength) return;
      // prevent leading zeros like 00
      if (next === '0' && key !== '.') next = key;
      else next = `${next}${key}`;
    }

    // enforce decimal precision
    if (next.includes('.')) {
      const [, frac] = next.split('.');
      if (frac != null && frac.length > decimalPlaces) return;
    }

    // prevent multiple leading zeros before decimal
    if (/^0\d+/.test(next)) next = String(parseInt(next, 10));

    onChange(next);
  };

  return (
    <View style={{ paddingHorizontal: containerPaddingHorizontal }}>
      {KEYS.map((row, rIdx) => (
        <View key={rIdx} style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: rowSpacing }}>
          {row.map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => handlePress(k)}
              activeOpacity={0.3}
              style={{
                height: keyHeight,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: keyBackground,
                flex: 1,
                borderRadius: 0,
              }}
            >
              <Text style={{ fontSize, fontWeight: '400' }}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
};

export default NumericKeypad;


