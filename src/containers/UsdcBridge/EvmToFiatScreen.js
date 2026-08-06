/*
  EvmToFiatScreen.js
  Part B Offramp: EVM USDC → Fiat (Paybis cashout — integrated flow)

  Flow:
  1. Load cashout options from POST /offramp/evm-to-fiat/options
  2. User selects payout method
  3. POST /offramp/evm-to-fiat/initiate → requestId + widgetUrl
  4. Open widgetUrl in InAppBrowser (KYC / bank account setup)
  5. After browser closes: poll GET /offramp/evm-to-fiat/payment-details/{requestId}
  6. Once ready: open ERC20 send modal (address + amount pre-filled and locked)
  7. On send complete: persist requestId, navigate to EvmToFiatProgressScreen
*/
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BigNumber from 'bignumber.js';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { usePrevious } from '../../hooks/usePrevious';
import { OFFRAMP_EVM_TO_FIAT_REQUEST_ID_KEY } from '../../utils/constants/constants';
import { SEND_MODAL_SEND_COMPLETED } from '../../utils/constants/sendModal';
import { openUsdcBridgeSendModal } from '../../actions/actions/sendModal/dispatchers/sendModal';
import ValuProvider from '../../utils/services/ValuProvider';
import Colors from '../../globals/colors';

const DETAILS_POLL_INTERVAL_MS = 10_000;
const DETAILS_TIMEOUT_MS = 900_000; // 15 minutes

const EvmToFiatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { usdcCoinId, cryptoBalance } = route.params ?? {};

  const isTestnet = useObjectSelector(state => {
    const overrides = state.authentication.activeAccount?.testnetOverrides ?? {};
    return Object.keys(overrides).length > 0;
  });
  const usdcSubWallet = useObjectSelector(
    state => (state.coinMenus.allSubWallets[usdcCoinId] || [])[0] ?? null,
  );

  // Get coinObj from active coins list (safe for dynamically-registered ERC20 tokens)
  const evmCoinObj = useObjectSelector(
    state => state.coins.activeCoinsForUser.find(c => c.id === usdcCoinId) ?? null,
  );
  const sendModal = useObjectSelector(state => state.sendModal);
  const prevSendModal = usePrevious(sendModal);

  const maxBalance = cryptoBalance
    ? BigNumber(cryptoBalance).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6)
    : '0';

  const [amount, setAmount] = useState(maxBalance !== '0' ? maxBalance : '');
  const [countryCode, setCountryCode] = useState('US');
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  // 'form' | 'polling_details' | 'send_pending'
  const [phase, setPhase] = useState('form');
  const [pendingCashout, setPendingCashout] = useState(null);
  const pollRef = useRef(null);
  const pollStartRef = useRef(null);

  // When the ERC20 send modal closes after a successful transfer → navigate to progress
  useEffect(() => {
    if (
      sendModal &&
      prevSendModal &&
      sendModal.type == null &&
      prevSendModal.type != null
    ) {
      if (prevSendModal.data?.[SEND_MODAL_SEND_COMPLETED] && pendingCashout) {
        AsyncStorage.setItem(
          OFFRAMP_EVM_TO_FIAT_REQUEST_ID_KEY,
          pendingCashout.requestId,
        );
        navigation.replace('EvmToFiatProgressScreen', {
          requestId: pendingCashout.requestId,
          usdcCoinId,
        });
      }
      setPendingCashout(null);
      setPhase('form');
    }
  }, [sendModal]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const loadOptions = useCallback(async () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Enter amount', 'Please enter a valid USDC amount first.');
      return;
    }
    setLoadingOptions(true);
    try {
      try { await ValuProvider.authenticate(); } catch (_) {}
      const res = await ValuProvider.getEvmToFiatOptions({
        countryCode,
        amount: amountNum.toFixed(2),
      });
      const data = res?.data ?? res;
      const fetchedOptions = data?.options ?? [];
      setOptions(fetchedOptions);
      setSelectedOption(null);
      if (!fetchedOptions.length) {
        Alert.alert('No options', 'No cashout options are available for this country/amount.');
      }
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Could not load cashout options.');
    } finally {
      setLoadingOptions(false);
    }
  }, [amount, countryCode]);

  const startPollingPaymentDetails = useCallback(
    (requestId, coinObj) => {
      pollStartRef.current = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - pollStartRef.current > DETAILS_TIMEOUT_MS) {
          clearInterval(pollRef.current);
          setPhase('form');
          Alert.alert(
            'Session expired',
            'Payment details were not ready in time. Please try again.',
          );
          return;
        }
        try {
          const res = await ValuProvider.getEvmToFiatPaymentDetails(requestId);
          const ready = res?.ready ?? res?.data?.ready;
          if (ready) {
            clearInterval(pollRef.current);
            const details = res?.data ?? res;
            const depositAddress = details?.depositAddress;
            const detailAmount = details?.amount;
            if (!depositAddress || !detailAmount) {
              setPhase('form');
              Alert.alert('Error', 'Payment details are incomplete. Please try again.');
              return;
            }
            if (!usdcSubWallet) {
              setPhase('form');
              Alert.alert('Error', 'USDC sub-wallet not found. Ensure the coin is added.');
              return;
            }
            setPhase('send_pending');
            openUsdcBridgeSendModal(coinObj, usdcSubWallet, depositAddress, detailAmount);
          }
        } catch (_) {
          // Silently retry
        }
      }, DETAILS_POLL_INTERVAL_MS);
    },
    [usdcSubWallet],
  );

  const onCashOut = useCallback(async () => {
    if (!selectedOption) {
      Alert.alert('Select option', 'Please select a cashout method first.');
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    if (amountNum > parseFloat(maxBalance)) {
      Alert.alert('Insufficient balance', `You only have ${maxBalance} USDC.`);
      return;
    }
    const coinObj = evmCoinObj;
    if (!coinObj) {
      Alert.alert('Error', 'USDC coin not found. Ensure it is added to your wallet.');
      return;
    }
    setLoading(true);
    try {
      try { await ValuProvider.authenticate(); } catch (_) {}
      const res = await ValuProvider.initiateEvmToFiat({
        option: selectedOption,
        countryCode,
      });
      const data = res?.data ?? res;
      const requestId = data?.requestId;
      const widgetUrl = data?.widgetUrl;
      if (!requestId || !widgetUrl) {
        throw new Error('Server did not return a valid cashout session.');
      }
      setPendingCashout({ requestId });
      setLoading(false);
      setPhase('polling_details');

      // Open the Paybis widget for KYC / bank account setup
      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(widgetUrl, {
          toolbarColor: Colors.primaryColor,
          navigationBarColor: Colors.primaryColor,
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          forceCloseOnRedirection: false,
        });
      } else {
        Alert.alert(
          'Browser unavailable',
          `Please open this URL manually:\n${widgetUrl}`,
        );
        setPhase('form');
        return;
      }

      // Widget closed — start polling for Paybis to generate the deposit address
      startPollingPaymentDetails(requestId, coinObj);
    } catch (e) {
      setLoading(false);
      setPhase('form');
      Alert.alert('Failed', e.message ?? 'An unexpected error occurred.');
    }
  }, [
    selectedOption,
    amount,
    maxBalance,
    countryCode,
    usdcCoinId,
    usdcSubWallet,
    startPollingPaymentDetails,
  ]);

  const networkLabel = isTestnet ? 'Polygon Amoy' : 'Ethereum';

  if (phase === 'polling_details') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primaryColor} size="large" />
        <Text style={styles.loadingText}>
          Waiting for Paybis to generate your deposit address…
        </Text>
        <Text style={[styles.loadingText, { marginTop: 8, fontSize: 12 }]}>
          This may take up to 30 seconds.
        </Text>
      </View>
    );
  }

  if (phase === 'send_pending') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primaryColor} size="large" />
        <Text style={styles.loadingText}>Opening USDC transfer screen…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Cash Out USDC to Fiat</Text>
      <Text style={styles.subtitle}>
        {`Convert your ${networkLabel} USDC to fiat currency via Paybis.`}
      </Text>

      <View style={styles.balanceRow}>
        <Text style={styles.label}>Available</Text>
        <Text style={styles.balance}>{maxBalance} USDC</Text>
      </View>

      <Text style={styles.fieldLabel}>Amount (USDC)</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
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

      <Text style={styles.fieldLabel}>Country code (2 letters)</Text>
      <TextInput
        style={styles.countryInput}
        value={countryCode}
        onChangeText={t => setCountryCode(t.toUpperCase().slice(0, 2))}
        placeholder="US"
        maxLength={2}
        autoCapitalize="characters"
        placeholderTextColor="#9CA3AF"
      />

      <TouchableOpacity
        style={[
          styles.button,
          styles.secondaryButton,
          loadingOptions && styles.buttonDisabled,
        ]}
        onPress={loadOptions}
        disabled={loadingOptions}
      >
        {loadingOptions ? (
          <ActivityIndicator color={Colors.primaryColor} />
        ) : (
          <Text style={styles.secondaryButtonText}>Get cashout options</Text>
        )}
      </TouchableOpacity>

      {options.length > 0 && (
        <View style={styles.optionsSection}>
          <Text style={styles.fieldLabel}>Select payout method</Text>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={opt.id ?? idx}
              style={[
                styles.optionRow,
                selectedOption?.id === opt.id && styles.optionRowSelected,
              ]}
              onPress={() => setSelectedOption(opt)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionName}>
                  {opt.name || opt.paymentMethod}
                </Text>
                <Text style={styles.optionDetail}>
                  {`Receive ~${opt.amountReceived} ${opt.sourceCurrency ?? ''}`}
                </Text>
              </View>
              {selectedOption?.id === opt.id && (
                <Text style={styles.optionCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          styles.primaryButton,
          (loading || !selectedOption) && styles.buttonDisabled,
        ]}
        onPress={onCashOut}
        disabled={loading || !selectedOption}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Cash Out</Text>
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
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  container: { padding: 20, flexGrow: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 20 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  label: { fontSize: 14, color: '#374151', fontWeight: '600' },
  balance: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  fieldLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#111827' },
  maxButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.primaryColor + '20',
    borderRadius: 6,
  },
  maxButtonText: { fontSize: 13, color: Colors.primaryColor, fontWeight: '600' },
  countryInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    letterSpacing: 4,
  },
  button: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  primaryButton: { backgroundColor: Colors.primaryColor },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primaryColor,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: Colors.primaryColor, fontSize: 15, fontWeight: '700' },
  optionsSection: { marginTop: 4 },
  optionRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionRowSelected: {
    borderColor: Colors.primaryColor,
    backgroundColor: Colors.primaryColor + '08',
  },
  optionName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  optionDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  optionCheck: { color: Colors.primaryColor, fontWeight: '700', fontSize: 16 },
});

export default EvmToFiatScreen;
