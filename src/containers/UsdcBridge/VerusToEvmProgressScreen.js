/*
  VerusToEvmProgressScreen.js
  Polls /offramp/verus-to-evm/status/:conversionId every 15 s.
  Status machine: PENDING → PROCESSING → EVM_PAID | TIMED_OUT | FAILED
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OFFRAMP_VERUS_TO_EVM_CONVERSION_ID_KEY } from '../../utils/constants/constants';
import ValuProvider from '../../utils/services/ValuProvider';
import Colors from '../../globals/colors';

const POLL_INTERVAL_MS = 15_000;

const STATUS_CONFIG = {
  PENDING: {
    icon: '⏳',
    label: 'Waiting for your vUSDC…',
    body: 'Send your vUSDC to the deposit address shown on the previous screen. The server will detect it automatically.',
    color: '#B45309',
    isFinal: false,
  },
  PROCESSING: {
    icon: '🔄',
    label: 'Sending USDC to your EVM wallet…',
    body: 'Your vUSDC was received. The server is now sending USDC to your EVM address.',
    color: '#1D4ED8',
    isFinal: false,
  },
  EVM_PAID: {
    icon: '✅',
    label: 'Bridge complete!',
    body: 'USDC has been sent to your EVM wallet.',
    color: '#15803D',
    isFinal: true,
  },
  TIMED_OUT: {
    icon: '⏰',
    label: 'Timed out',
    body: 'No vUSDC was received within 24 hours. Please start again.',
    color: '#B91C1C',
    isFinal: true,
  },
  FAILED: {
    icon: '⚠️',
    label: 'Failed – contact support',
    body: 'An error occurred processing this conversion. Please contact support.',
    color: '#B91C1C',
    isFinal: true,
  },
  UNKNOWN: {
    icon: '🔍',
    label: 'Checking status…',
    body: '',
    color: '#6B7280',
    isFinal: false,
  },
};

const VerusToEvmProgressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    conversionId,
    verusDepositAddress,
    amount,
    vUsdcCoinId,
    evmCoinId,
  } = route.params ?? {};

  const [status, setStatus] = useState('PENDING');
  const [evmPayoutTxid, setEvmPayoutTxid] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const poll = useCallback(async () => {
    if (!conversionId) return;
    try {
      try { await ValuProvider.authenticate(); } catch (_) {}
      const res = await ValuProvider.getVerusToEvmStatus(conversionId);
      const data = res?.data ?? res;
      const newStatus = data?.status ?? 'UNKNOWN';
      setStatus(newStatus);
      setLastUpdated(new Date().toLocaleTimeString());
      if (data?.evmPayoutTxid) setEvmPayoutTxid(data.evmPayoutTxid);
      if (STATUS_CONFIG[newStatus]?.isFinal) {
        clearInterval(pollRef.current);
        await AsyncStorage.removeItem(OFFRAMP_VERUS_TO_EVM_CONVERSION_ID_KEY);
      }
    } catch (e) {
      setError(e.message ?? 'Status check failed');
    }
  }, [conversionId]);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [poll]);

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN;

  const openExplorer = useCallback((txHash) => {
    Linking.openURL(`https://etherscan.io/tx/${txHash}`).catch(() => {});
  }, []);

  const handleRetry = useCallback(() => {
    navigation.replace('VerusToEvmScreen', { vUsdcCoinId, evmCoinId });
  }, [navigation, vUsdcCoinId, evmCoinId]);

  const handleDone = useCallback(
    () => navigation.navigate('Wallets'),
    [navigation],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.statusCard, { borderColor: cfg.color + '40' }]}>
        <Text style={styles.statusIcon}>{cfg.icon}</Text>
        <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        <Text style={styles.statusBody}>{cfg.body}</Text>
        {!cfg.isFinal && (
          <ActivityIndicator color={cfg.color} size="small" style={{ marginTop: 12 }} />
        )}
      </View>

      {amount != null && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Amount</Text>
          <Text style={styles.rowValue}>{amount} vUSDC</Text>
        </View>
      )}

      {verusDepositAddress != null && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Deposit address</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {verusDepositAddress}
          </Text>
        </View>
      )}

      {evmPayoutTxid && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => openExplorer(evmPayoutTxid)}
          activeOpacity={0.7}
        >
          <Text style={styles.rowLabel}>EVM payout tx</Text>
          <Text style={[styles.rowValue, styles.link]}>
            {evmPayoutTxid.slice(0, 12)}…
          </Text>
        </TouchableOpacity>
      )}

      {lastUpdated && (
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
      )}

      {error != null && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actions}>
        {status === 'TIMED_OUT' && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#B91C1C' }]}
            onPress={handleRetry}
          >
            <Text style={styles.buttonText}>Retry bridge</Text>
          </TouchableOpacity>
        )}
        {cfg.isFinal && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: Colors.primaryColor }]}
            onPress={handleDone}
          >
            <Text style={styles.buttonText}>Back to Wallet</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, flexGrow: 1, backgroundColor: '#fff' },
  statusCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#FAFAFA',
  },
  statusIcon: { fontSize: 40, marginBottom: 10 },
  statusLabel: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  statusBody: { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLabel: { fontSize: 14, color: '#6B7280' },
  rowValue: { fontSize: 14, color: '#1F2937', fontWeight: '500', maxWidth: '50%', textAlign: 'right' },
  link: { color: Colors.primaryColor, textDecorationLine: 'underline' },
  lastUpdated: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 16 },
  errorText: { color: '#B91C1C', fontSize: 13, textAlign: 'center', marginTop: 8 },
  actions: { marginTop: 32, gap: 12 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default VerusToEvmProgressScreen;
