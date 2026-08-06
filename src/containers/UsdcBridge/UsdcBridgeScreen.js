/*
  UsdcBridgeScreen.js
  Lets the user initiate a USDC → vUSDC bridge via the Valu onramp API.

  Flow:
  1. Show USDC balance + amount input
  2. On "Bridge" press:
     a. Authenticate with Valu if needed
     b. POST /onramp/initiate-usdc-to-verus → get conversionId + uniquePaymentAddress
     c. Call ERC20 transfer(uniquePaymentAddress, amount) — triggers password prompt
     d. Persist conversionId to AsyncStorage
     e. Navigate to UsdcBridgeProgressScreen
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BigNumber from 'bignumber.js';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { usePrevious } from '../../hooks/usePrevious';
import { ERC20, VRPC } from '../../utils/constants/intervalConstants';
import {
  USDC_ETH_MAINNET_COIN_ID,
  USDC_POLYGON_AMOY_COIN_ID,
  USDC_BRIDGE_CONVERSION_ID_KEY,
} from '../../utils/constants/constants';
import { SEND_MODAL_SEND_COMPLETED } from '../../utils/constants/sendModal';
import { openUsdcBridgeSendModal } from '../../actions/actions/sendModal/dispatchers/sendModal';
import ValuProvider from '../../utils/services/ValuProvider';
import Colors from '../../globals/colors';

const UsdcBridgeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { usdcCoinId, cryptoBalance } = route.params ?? {};

  const activeAccount = useObjectSelector(
    (state) => state.authentication.activeAccount,
  );

  const isTestnet =
    activeAccount?.testnetOverrides &&
    Object.keys(activeAccount.testnetOverrides).length > 0;

  const [amount, setAmount] = useState(
    cryptoBalance ? BigNumber(cryptoBalance).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6) : '',
  );
  const [loading, setLoading] = useState(false);
  // Holds the pending bridge data while the send modal is open
  const [pendingBridge, setPendingBridge] = useState(null);

  // Watch the send modal so we can navigate to the progress screen once the
  // user confirms the ERC20 transfer inside the standard review flow.
  const sendModal = useObjectSelector((state) => state.sendModal);
  const prevSendModal = usePrevious(sendModal);

  // The ERC20 sub-wallet for the USDC coin (needed by the send modal)
  const usdcSubWallet = useObjectSelector(
    (state) => (state.coinMenus.allSubWallets[usdcCoinId] || [])[0] ?? null,
  );

  // Get coinObj from active coins list (safe for dynamically-registered ERC20 tokens)
  const coinObj = useObjectSelector(
    (state) => state.coins.activeCoinsForUser.find(c => c.id === usdcCoinId) ?? null,
  );

  // Determine the Verus R-address to receive vUSDC
  const verusNetworkKey = isTestnet ? 'VRSCTEST' : 'VRSC';

  const verusAddress =
    activeAccount?.keys?.[verusNetworkKey]?.[VRPC]?.addresses?.[0] ?? '';

  // EVM sending address for the USDC coin
  const evmAddress =
    (usdcCoinId && activeAccount?.keys?.[usdcCoinId]?.[ERC20]?.addresses?.[0]) ?? '';

  const maxBalance = cryptoBalance
    ? BigNumber(cryptoBalance).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6)
    : '0';

  // When the send modal closes after a successful send, navigate to the
  // progress screen with the txid that the standard confirm flow produced.
  useEffect(() => {
    if (
      sendModal &&
      prevSendModal &&
      sendModal.type == null &&
      prevSendModal.type != null
    ) {
      if (prevSendModal.data?.[SEND_MODAL_SEND_COMPLETED] && pendingBridge) {
        const txResult = prevSendModal.data[SEND_MODAL_SEND_COMPLETED];
        AsyncStorage.setItem(USDC_BRIDGE_CONVERSION_ID_KEY, pendingBridge.conversionId);
        navigation.replace('UsdcBridgeProgressScreen', {
          conversionId: pendingBridge.conversionId,
          txid: txResult?.txid,
          amount: pendingBridge.amount,
          usdcCoinId,
        });
      }
      // Clear pending state whether the user completed or cancelled
      setPendingBridge(null);
    }
  }, [sendModal]);

  const onSetMax = useCallback(() => {
    setAmount(maxBalance);
  }, [maxBalance]);

  const onBridge = useCallback(async () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid USDC amount.');
      return;
    }
    if (amountNum > parseFloat(maxBalance)) {
      Alert.alert('Insufficient balance', `You only have ${maxBalance} USDC.`);
      return;
    }
    if (!verusAddress) {
      Alert.alert('No Verus address', 'Could not find a Verus address to receive vUSDC.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: authenticate with Valu
      try {
        await ValuProvider.authenticate();
      } catch (e) {
        // Already authenticated is fine
      }

      // Step 2: register the conversion — server returns uniquePaymentAddress
      const initRes = await ValuProvider.initiateUsdcToVerus({
        sendingAddress: evmAddress,
        verusPaymentAddress: verusAddress,
        amount: amountNum.toFixed(6),
      });

      const conversionId = initRes?.id ?? initRes?.data?.id;
      const uniquePaymentAddress =
        initRes?.uniquePaymentAddress ?? initRes?.data?.uniquePaymentAddress;

      if (!conversionId || !uniquePaymentAddress) {
        throw new Error('Server did not return a valid conversion record.');
      }

      if (!coinObj) throw new Error('USDC coin not found. Ensure it is added to your wallet.');
      if (!usdcSubWallet) throw new Error('USDC sub-wallet not found.');

      // Step 3: store pending bridge data, then open the standard send-review
      // modal so the user can inspect and confirm the ERC20 transfer before it
      // is submitted.  Navigation to UsdcBridgeProgressScreen happens inside
      // the useEffect above once SEND_MODAL_SEND_COMPLETED is set.
      setPendingBridge({ conversionId, amount: amountNum.toFixed(6) });
      openUsdcBridgeSendModal(coinObj, usdcSubWallet, uniquePaymentAddress, amountNum.toFixed(6));
    } catch (e) {
      Alert.alert('Bridge failed', e.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [amount, maxBalance, verusAddress, evmAddress, usdcCoinId, usdcSubWallet, navigation]);

  const networkLabel = isTestnet ? 'Polygon Amoy' : 'Ethereum';
  const verusLabel = isTestnet ? 'vUSDC (VRSCTEST)' : 'vUSDC.vETH (VRSC)';

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Bridge USDC to Verus</Text>
      <Text style={styles.subtitle}>
        Send your {networkLabel} USDC to receive {verusLabel} on the Verus network.
      </Text>

      {/* Balance */}
      <View style={styles.balanceRow}>
        <Text style={styles.label}>Available</Text>
        <Text style={styles.balance}>{maxBalance} USDC</Text>
      </View>

      {/* Amount input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.000000"
          placeholderTextColor="#9CA3AF"
          editable={!loading}
        />
        <TouchableOpacity onPress={onSetMax} style={styles.maxButton} disabled={loading}>
          <Text style={styles.maxButtonText}>MAX</Text>
        </TouchableOpacity>
      </View>

      {/* Addresses */}
      <View style={styles.addressSection}>
        <Text style={styles.label}>Sending from ({networkLabel})</Text>
        <Text style={styles.address} numberOfLines={1} ellipsizeMode="middle">
          {evmAddress || '—'}
        </Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Receiving at (Verus)</Text>
        <Text style={styles.address} numberOfLines={1} ellipsizeMode="middle">
          {verusAddress || '—'}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Your USDC will be sent to the Valu bridge deposit address. Once confirmed on-chain,
          {' '}{verusLabel} will be delivered to your Verus wallet. This may take a few minutes.
        </Text>
      </View>

      {/* Bridge button */}
      <TouchableOpacity
        style={[styles.bridgeButton, loading && styles.bridgeButtonDisabled]}
        onPress={onBridge}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.bridgeButtonText}>Send to Verus →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balance: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    marginBottom: 20,
    paddingVertical: 4,
    paddingLeft: 0,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '600',
  },
  maxButton: {
    backgroundColor: Colors.primaryColor,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 4,
  },
  maxButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  addressSection: {
    marginBottom: 20,
  },
  address: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'monospace',
    marginTop: 4,
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 6,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 13,
    color: '#1D4ED8',
    lineHeight: 19,
  },
  bridgeButton: {
    backgroundColor: Colors.primaryColor,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bridgeButtonDisabled: {
    opacity: 0.6,
  },
  bridgeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default UsdcBridgeScreen;
