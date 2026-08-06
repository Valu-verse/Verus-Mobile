/*
  EvmToFiatProgressScreen.js
  Polls /offramp/evm-to-fiat/status/:requestId every 15 s.
  Status: INITIATED → STARTED → CONFIRMED | FAILED
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OFFRAMP_EVM_TO_FIAT_REQUEST_ID_KEY } from '../../utils/constants/constants';
import ValuProvider from '../../utils/services/ValuProvider';
import Colors from '../../globals/colors';

const POLL_INTERVAL_MS = 15_000;

const STATUS_CONFIG = {
  INITIATED: {
    icon: '⏳',
    label: 'Setting up your cashout…',
    body: 'Please complete the Paybis widget to set up your bank account and payment method.',
    color: '#B45309',
    isFinal: false,
  },
  STARTED: {
    icon: '🔄',
    label: 'USDC received – processing payout…',
    body: 'Paybis has received your USDC and is processing your fiat payout.',
    color: '#1D4ED8',
    isFinal: false,
  },
  CONFIRMED: {
    icon: '✅',
    label: 'Cashout complete!',
    body: 'Your fiat payout has been initiated. Funds typically arrive within 1–3 business days.',
    color: '#15803D',
    isFinal: true,
  },
  FAILED: {
    icon: '❌',
    label: 'Transaction failed',
    body: 'The cashout failed. Please contact support if funds were deducted.',
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

const EvmToFiatProgressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { requestId, usdcCoinId } = route.params ?? {};

  const [status, setStatus] = useState('INITIATED');
  const [details, setDetails] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const poll = useCallback(async () => {
    if (!requestId) return;
    try {
      try { await ValuProvider.authenticate(); } catch (_) {}
      const res = await ValuProvider.getEvmToFiatStatus(requestId);
      const data = res?.data ?? res;
      const newStatus = data?.status ?? 'UNKNOWN';
      setStatus(newStatus);
      setDetails(data);
      setLastUpdated(new Date().toLocaleTimeString());
      if (STATUS_CONFIG[newStatus]?.isFinal) {
        clearInterval(pollRef.current);
        await AsyncStorage.removeItem(OFFRAMP_EVM_TO_FIAT_REQUEST_ID_KEY);
      }
    } catch (e) {
      setError(e.message ?? 'Status check failed');
    }
  }, [requestId]);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [poll]);

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN;

  const handleRetry = useCallback(
    () => navigation.replace('EvmToFiatScreen', { usdcCoinId }),
    [navigation, usdcCoinId],
  );

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

      {details?.sourceTotalAmount != null && details?.sourceCurrency != null && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Cashout amount</Text>
          <Text style={styles.rowValue}>
            {details.sourceTotalAmount} {details.sourceCurrency}
          </Text>
        </View>
      )}

      {lastUpdated != null && (
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
      )}

      {error != null && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actions}>
        {status === 'FAILED' && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#B91C1C' }]}
            onPress={handleRetry}
          >
            <Text style={styles.buttonText}>Try again</Text>
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
  rowValue: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  lastUpdated: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 16 },
  errorText: { color: '#B91C1C', fontSize: 13, textAlign: 'center', marginTop: 8 },
  actions: { marginTop: 32, gap: 12 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default EvmToFiatProgressScreen;
