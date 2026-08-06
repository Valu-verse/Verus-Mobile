/*
  VerusToEvmScreen.js
  Part A Offramp: vUSDC / vUSDC.vETH → EVM USDC

  Flow:
  1. Call GET /offramp/verus-to-evm/deposit-info → verusDepositAddress + verusCurrency
  2. User reviews amount and EVM payout address (auto-filled)
  3. Call POST /offramp/verus-to-evm/initiate → conversionId
  4. Show verusDepositAddress with copy button and instructions
  5. Navigate to VerusToEvmProgressScreen
*/
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BigNumber from 'bignumber.js';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { ERC20 } from '../../utils/constants/intervalConstants';
import { OFFRAMP_VERUS_TO_EVM_CONVERSION_ID_KEY } from '../../utils/constants/constants';
import ValuProvider from '../../utils/services/ValuProvider';
import Colors from '../../globals/colors';

const VerusToEvmScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { vUsdcCoinId, evmCoinId, cryptoBalance } = route.params ?? {};

  const activeAccount = useObjectSelector(state => state.authentication.activeAccount);
  const isTestnet =
    activeAccount?.testnetOverrides &&
    Object.keys(activeAccount.testnetOverrides).length > 0;

  // User's EVM address where they will receive the USDC payout
  const evmAddress =
    (evmCoinId && activeAccount?.keys?.["USDC"]?.[ERC20]?.addresses?.[0]) ?? '';

  const maxBalance = cryptoBalance
    ? BigNumber(cryptoBalance).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6)
    : '0';

  const [amount, setAmount] = useState(maxBalance !== '0' ? maxBalance : '');
  const [depositInfo, setDepositInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loading, setLoading] = useState(false);
  // After initiation: { conversionId, verusDepositAddress, amount }
  const [registered, setRegistered] = useState(null);

  useEffect(() => {
    (async () => {
      setLoadingInfo(true);
      try {
        try { await ValuProvider.authenticate(); } catch (_) {}
        const res = await ValuProvider.getVerusToEvmDepositInfo();
        setDepositInfo(res?.data ?? res);
      } catch (e) {
        Alert.alert('Error', 'Could not load deposit info: ' + (e.message ?? 'Unknown error'));
      } finally {
        setLoadingInfo(false);
      }
    })();
  }, []);

  const onBridgeToEvm = useCallback(async () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    if (amountNum > parseFloat(maxBalance)) {
      const ticker = depositInfo?.verusCurrency ?? 'vUSDC';
      Alert.alert('Insufficient balance', `You only have ${maxBalance} ${ticker}.`);
      return;
    }
    if (!evmAddress) {
      Alert.alert('No EVM address', 'Could not find your EVM wallet address.');
      return;
    }
    setLoading(true);
    try {
      try { await ValuProvider.authenticate(); } catch (_) {}
      const res = await ValuProvider.initiateVerusToEvmOfframp({
        evmPayoutAddress: evmAddress,
        amount: amountNum.toFixed(6),
      });
      const data = res?.data ?? res;
      const conversionId = data?.id;
      const verusDepositAddress =
        data?.verusDepositAddress ?? depositInfo?.verusDepositAddress;
      if (!conversionId || !verusDepositAddress) {
        throw new Error('Server did not return a valid conversion record.');
      }
      await AsyncStorage.setItem(OFFRAMP_VERUS_TO_EVM_CONVERSION_ID_KEY, conversionId);
      setRegistered({ conversionId, verusDepositAddress, amount: amountNum.toFixed(6) });
    } catch (e) {
      Alert.alert('Bridge failed', e.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [amount, maxBalance, evmAddress, depositInfo]);

  const onCopy = useCallback(() => {
    if (registered?.verusDepositAddress) {
      Clipboard.setString(registered.verusDepositAddress);
      Alert.alert('Copied', 'Deposit address copied to clipboard.');
    }
  }, [registered]);

  const onGoToProgress = useCallback(() => {
    navigation.replace('VerusToEvmProgressScreen', {
      conversionId: registered.conversionId,
      verusDepositAddress: registered.verusDepositAddress,
      amount: registered.amount,
      vUsdcCoinId,
      evmCoinId,
    });
  }, [registered, navigation, vUsdcCoinId, evmCoinId]);

  const verusCurrency =
    depositInfo?.verusCurrency ?? (isTestnet ? 'vUSDC' : 'vUSDC.vETH');
  const evmNetworkLabel = isTestnet ? 'Polygon Amoy' : 'Ethereum';

  if (loadingInfo) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primaryColor} size="large" />
        <Text style={styles.loadingText}>Loading deposit info…</Text>
      </View>
    );
  }

  // Post-registration: show deposit address
  if (registered) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.instructionCard}>
          <Text style={styles.instructionIcon}>📋</Text>
          <Text style={styles.instructionTitle}>Send your {verusCurrency}</Text>
          <Text style={styles.instructionBody}>
            {`Send exactly ${registered.amount} ${verusCurrency} to the Verus address below from your Verus wallet. The server will automatically detect your deposit and send USDC to your EVM wallet.`}
          </Text>
        </View>
        <View style={styles.addressCard}>
          <Text style={styles.addressLabel}>Verus deposit address</Text>
          <Text style={styles.addressText} selectable>
            {registered.verusDepositAddress}
          </Text>
          <TouchableOpacity style={styles.copyButton} onPress={onCopy}>
            <Text style={styles.copyButtonText}>Copy address</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Amount to send</Text>
          <Text style={styles.rowValue}>{registered.amount} {verusCurrency}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>USDC payout to</Text>
          <Text style={styles.rowValue} numberOfLines={1}>{evmAddress}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>EVM network</Text>
          <Text style={styles.rowValue}>{evmNetworkLabel}</Text>
        </View>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={onGoToProgress}>
          <Text style={styles.buttonText}>Track status →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Entry form
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Bridge {verusCurrency} to USDC</Text>
      <Text style={styles.subtitle}>
        {`Your ${verusCurrency} on Verus will be converted to USDC on ${evmNetworkLabel}.`}
      </Text>
      <View style={styles.balanceRow}>
        <Text style={styles.label}>Available</Text>
        <Text style={styles.balance}>{maxBalance} {verusCurrency}</Text>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount"
          keyboardType="decimal-pad"
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity
          style={styles.maxButton}
          onPress={() => setAmount(maxBalance)}
        >
          <Text style={styles.maxButtonText}>Max</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.evmAddressBox}>
        <Text style={styles.evmAddressLabel}>Your EVM payout address</Text>
        <Text style={styles.evmAddressValue} numberOfLines={1}>
          {evmAddress || '(address not found)'}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.button,
          styles.primaryButton,
          (loading || !depositInfo) && styles.buttonDisabled,
        ]}
        onPress={onBridgeToEvm}
        disabled={loading || !depositInfo}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send to Polygon</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  container: { padding: 20, flexGrow: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 20 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 14, color: '#374151', fontWeight: '600' },
  balance: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#111827' },
  maxButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.primaryColor + '20',
    borderRadius: 6,
  },
  maxButtonText: { fontSize: 13, color: Colors.primaryColor, fontWeight: '600' },
  evmAddressBox: {
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    marginBottom: 24,
  },
  evmAddressLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  evmAddressValue: { fontSize: 13, color: '#374151', fontWeight: '500' },
  button: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButton: { backgroundColor: Colors.primaryColor },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Post-registration
  instructionCard: {
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#F0FDF4',
  },
  instructionIcon: { fontSize: 36, marginBottom: 8 },
  instructionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 6,
  },
  instructionBody: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 18,
  },
  addressCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addressLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  addressText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryColor,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  copyButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLabel: { fontSize: 14, color: '#6B7280' },
  rowValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    maxWidth: '55%',
    textAlign: 'right',
  },
});

export default VerusToEvmScreen;
