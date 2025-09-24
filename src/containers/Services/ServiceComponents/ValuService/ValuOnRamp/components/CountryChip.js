/*
  New component: CountryChip
  - Displays current country (emoji + name) in a compact chip
*/

import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function CountryChip({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.chip} activeOpacity={0.7}>
      <Text style={styles.text}>{label}</Text>
      <Text style={styles.icon}>⌄</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  text: { fontSize: 12, color: '#333', marginRight: 4 },
  icon: { fontSize: 12, color: '#888' },
});


