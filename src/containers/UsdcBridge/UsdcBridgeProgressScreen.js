/*
  UsdcBridgeProgressScreen.js
  Polls /onramp/usdc-to-verus/status/:conversionId every 15 seconds
  and shows the current state of a USDC → vUSDC bridge conversion.

  Status machine: PENDING → PROCESSING → VERUS_PAID (success) | TIMED_OUT
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
import {
  USDC_BRIDGE_CONVERSION_ID_KEY,
} from '../../utils/constants/constants';
import ValuProvider from '../../utils/services/ValuProvider';
import Colors from '../../globals/colors';

const POLL_INTERVAL_MS = 15_000;

const STATUS_CONFIG = {
  PENDING: {
    icon: '⏳',
    label: 'Waiting for USDC',
    body: 'The server is watching for your USDC deposit. This may take 1–2 minutes.',
    color: '#B45309',
    isFinal: false,
  },
  PROCESSING: {
    icon: '🔄',
    label: 'Bridge in progress',
    body: 'Your USDC has been received. Sending vUSDC to your Verus wallet…',
    color: '#1D4ED8',
    isFinal: false,
  },
  VERUS_PAID: {
    icon: '✅',
    label: 'Bridge complete!',
    body: 'Your vUSDC has arrived in your Verus wallet.',
    color: '#15803D',
    isFinal: true,
  },
  TIMED_OUT: {
    icon: '⚠️',
    label: 'Bridge timed out',
    body: 'No USDC was detected within 24 hours. Please try again.',
    color: '#B91C1C',
    isFinal: true,
  },
  FAILED: {
    icon: '⚠️',
    label: 'Retrying…',
    body: 'A transient error occurred. The server will retry automatically.',
    color: '#B45309',
    isFinal: false,
  },
  UNKNOWN: {
    icon: '🔍',
    label: 'Checking status…',
    body: '',
    color: '#6B7280',
    isFinal: false,
  },
};

const UsdcBridgeProgressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { conversionId, txid, amount, usdcCoinId } = route.params ?? {};

  const [status, setStatus] = useState('PENDING');
  const [verusPayoutTxid, setVerusPayoutTxid] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const poll = useCallback(async () => {
    if (!conversionId) return;
    try {
      // Ensure auth
      try { await ValuProvider.authenticate(); } catch (_) {}

      const res = await ValuProvider.getUsdcConversionStatus(conversionId);
      const data = res?.data ?? res;

      const newStatus = data?.status ?? 'UNKNOWN';
      setStatus(newStatus);
      setLastUpdated(new Date().toLocaleTimeString());

      if (data?.verusPayoutTxid) setVerusPayoutTxid(data.verusPayoutTxid);

      // Stop polling when final
      if (STATUS_CONFIG[newStatus]?.isFinal) {
        clearInterval(pollRef.current);
        // Clear persisted conversionId
        await AsyncStorage.removeItem(USDC_BRIDGE_CONVERSION_ID_KEY);
      }
    } catch (e) {
      setError(e.message ?? 'Status check failed');
    }
  }, [conversionId]);

  useEffect(() => {
    poll(); // immediate first check
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [poll]);

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN;

  const openExplorer = useCallback((txHash, isVerus) => {
    const url = isVerus
      ? `https://insight.verus.io/tx/${txHash}`
      : `https://etherscan.io/tx/${txHash}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  const handleRetry = useCallback(() => {
    navigation.replace('UsdcBridgeScreen', { usdcCoinId });
  }, [navigation, usdcCoinId]);

  const handleDone = useCallback(() => {
    navigation.navigate('Wallets');
  }, [navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Status card */}
      <View style={[styles.statusCard, { borderColor: cfg.color + '40' }]}>
        <Text style={styles.statusIcon}>{cfg.icon}</Text>
        <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        <Text style={styles.statusBody}>{cfg.body}</Text>
        {!cfg.isFinal && (
          <ActivityIndicator
            color={cfg.color}
            size="small"
            style={{ marginTop: 12 }}
          />
        )}
      </View>

      {/* Amount */}
      {amount != null && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Amount</Text>
          <Text style={styles.rowValue}>{amount} USDC</Text>
        </View>
      )}

      {/* EVM tx */}
      {txid && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => openExplorer(txid, false)}
          activeOpacity={0.7}
        >
          <Text style={styles.rowLabel}>EVM transaction</Text>
          <Text style={[styles.rowValue, styles.link]}>{txid.slice(0, 12)}…</Text>
        </TouchableOpacity>
      )}

      {/* Verus payout tx */}
      {verusPayoutTxid && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => openExplorer(verusPayoutTxid, true)}
          activeOpacity={0.7}
        >
          <Text style={styles.rowLabel}>Verus payout tx</Text>
          <Text style={[styles.rowValue, styles.link]}>{verusPayoutTxid.slice(0, 12)}…</Text>
        </TouchableOpacity>
      )}

      {/* Last polled */}
      {lastUpdated && (
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
      )}

      {/* Error message */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Actions */}
      <View style={styles.actions}>
        {status === 'TIMED_OUT' && (
          <TouchableOpacity style={[styles.button, styles.retryButton]} onPress={handleRetry}>
            <Text style={styles.buttonText}>Retry bridge</Text>
          </TouchableOpacity>
        )}
        {cfg.isFinal && (
          <TouchableOpacity style={[styles.button, styles.doneButton]} onPress={handleDone}>
            <Text style={styles.buttonText}>Back to Wallet</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  statusCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#FAFAFA',
  },
  statusIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusBody: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  rowValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  link: {
    color: Colors.primaryColor,
    textDecorationLine: 'underline',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#B91C1C',
  },
  doneButton: {
    backgroundColor: Colors.primaryColor,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default UsdcBridgeProgressScreen;
