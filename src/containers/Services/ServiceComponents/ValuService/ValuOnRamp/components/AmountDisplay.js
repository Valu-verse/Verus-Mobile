/*
  New component: AmountDisplay
  - Shows large formatted amount and currency inline
  - Supports shrink-to-fit via adjustsFontSizeToFit
*/

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function AmountDisplay({ label = 'You pay', amount, currency, onChangeError, error }) {
  const formatted = formatAmount(amount);
  return (
    <View style={{ width: '90%', marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start', width: '100%' }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.amount}>
          {formatted}
          <Text style={styles.currency}>{` ${currency}`}</Text>
        </Text>
      </View>
      {error && (
        <Text style={styles.error}>{String(error).replace(' - ', '')}</Text>
      )}
    </View>
  );
}

const formatAmount = (raw = '0') => {
  if (raw == null || raw === '') return '0';
  const [int = '0', frac] = String(raw).split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac != null ? `${withCommas}.${frac}` : withCommas;
};

const styles = StyleSheet.create({
  label: { fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'left' },
  amount: { fontSize: 72, fontWeight: '700', color: '#1A1A1A', includeFontPadding: false },
  currency: { fontSize: 72, fontWeight: '600', color: '#888', includeFontPadding: false },
  error: { fontSize: 12, color: '#FF6B35', marginTop: 8, textAlign: 'left' },
});


