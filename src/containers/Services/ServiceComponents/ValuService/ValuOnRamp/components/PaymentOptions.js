/*
  New component: PaymentOptions
  - Displays a compact list of up to 3 payment options in a single bordered container
  - Three-column layout: method | fee% | amount received
  - Includes an adaptive skeleton (2 rows) for loading state
*/

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

const formatNum = (n) => {
  if (n == null) return '—';
  const parts = String(Number(n).toFixed(2)).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

export default function PaymentOptions({ options = [], loading = false }) {
  if (loading) return <Skeleton />;
  if (!Array.isArray(options) || options.length === 0) return null;

  const sorted = [...options].sort((a, b) => Number(a.feePercentage || 0) - Number(b.feePercentage || 0));
  const visible = sorted.slice(0, 3);
  const hasMore = sorted.length > 3;

  return (
    <View style={{ width: '100%', alignItems: 'center', marginTop: 4 }}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>Payment options</Text>
        <Text style={styles.headerText}>Receive vUSDC</Text>
      </View>
      <View style={styles.container}>
        {visible.map((route, idx) => (
          <View key={`${route.paymentMethod}-${idx}`}>
            <View style={styles.row3Col}>
              <Text style={styles.method}>{route.paymentMethod}</Text>
              <Text style={styles.fee}>{`${Number(route.feePercentage || 0).toFixed(1)}%`}</Text>
              <Text style={styles.amount}>{formatNum(route.amountReceived)}</Text>
            </View>
            {idx < visible.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
        {hasMore && (
          <>
            <View style={styles.divider} />
            <View style={styles.moreRow}>
              <Text style={styles.moreText}>{`and ${sorted.length - 3} more option${sorted.length - 3 > 1 ? 's' : ''}`}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function Skeleton() {
  return (
    <View style={{ width: '100%', alignItems: 'center', marginTop: 4 }}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>Payment options</Text>
        <Text style={styles.headerText}>Receive vUSDC</Text>
      </View>
      <View style={styles.container}>
        <View>
          <View style={styles.skelRow3Col}>
            <View style={[styles.skelBlock, { flex: 2, marginRight: 8 }]} />
            <View style={[styles.skelBlock, { flex: 1, marginHorizontal: 4, width: 30 }]} />
            <View style={[styles.skelBlock, { flex: 1, marginLeft: 8, width: 50 }]} />
          </View>
          <View style={styles.divider} />
        </View>
        <View>
          <View style={styles.skelRow3Col}>
            <View style={[styles.skelBlock, { flex: 2, marginRight: 8 }]} />
            <View style={[styles.skelBlock, { flex: 1, marginHorizontal: 4, width: 30 }]} />
            <View style={[styles.skelBlock, { flex: 1, marginLeft: 8, width: 50 }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    width: '90%',
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerText: { fontSize: 13, color: '#666' },
  container: {
    width: '90%',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    paddingVertical: 4,
  },
  row3Col: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  method: { fontSize: 12, color: '#1A1A1A', fontWeight: '500', flex: 2 },
  fee: { fontSize: 12, color: '#999', textAlign: 'center', flex: 1 },
  amount: { fontSize: 12, color: '#1A1A1A', fontWeight: '600', textAlign: 'right', flex: 1 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  moreRow: { paddingVertical: 8, alignItems: 'center' },
  moreText: { fontSize: 12, color: '#888', fontStyle: 'italic' },
  skelRow3Col: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  skelBlock: { height: 14, backgroundColor: '#E8E8E8', borderRadius: 4, width: '80%' },
});


