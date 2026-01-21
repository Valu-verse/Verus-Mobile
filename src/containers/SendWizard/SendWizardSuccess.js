/*
  SendWizardSuccess
  - Step 6: Transaction success screen
  - Shows animated checkmark and transaction summary
  - Allows user to copy txid and navigate back to Wallet screen
  - Created 2024-12-15
  - Updated 2026-01-15: Reset wizard state on unmount and
    return to Home via parent reset to avoid hook errors.
  - Updated 2026-01-21: Added fiat amount display, made checkmark smaller,
    improved copy button feedback to show "Copied" text with timeout.
*/

import React, { useCallback, useLayoutEffect, useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Clipboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import Colors from '../../globals/colors';
import BigNumber from 'bignumber.js';
import { useSendWizard } from './SendWizardContext';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import { getCurrencyDisplayName } from './sendWizardDisplayInfo';
import GradientButton from '../../components/GradientButton';
import AnimatedSuccessCheckmark from '../../components/AnimatedSuccessCheckmark';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { GENERAL, WYRE_SERVICE, USD } from '../../utils/constants/intervalConstants';

const SendWizardSuccess = () => {
  const navigation = useNavigation();
  const { state, reset } = useSendWizard();
  const {
    sourceCoin,
    targetCurrency,
    isConversion,
    amount,
    estimate,
    recipientAddress,
    txResult,
  } = state;

  // Copy feedback state
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);

  // Fiat display currency and rates
  const displayCurrency = useSelector(
    (s) => s.settings.generalWalletSettings.displayCurrency || USD,
  );
  const rates = useObjectSelector((s) => s.ledger.rates);

  // Get rate for a specific coin
  const getRate = useCallback(
    (coinId) => {
      if (!coinId) return null;
      return rates?.[WYRE_SERVICE]?.[coinId]?.[displayCurrency] != null
        ? rates[WYRE_SERVICE][coinId][displayCurrency]
        : rates?.[GENERAL]?.[coinId]?.[displayCurrency] != null
          ? rates[GENERAL][coinId][displayCurrency]
          : null;
    },
    [rates, displayCurrency],
  );

  // Calculate fiat display for amount
  const amountFiatDisplay = useMemo(() => {
    if (!amount || !sourceCoin?.id) return null;
    const rate = getRate(sourceCoin.id);
    if (!rate) return null;
    try {
      const fiatValue = BigNumber(amount).multipliedBy(BigNumber(rate));
      if (fiatValue.isNaN() || !fiatValue.isFinite()) return null;
      const [formatted] = formatCurrency({
        amount: fiatValue.decimalPlaces(2, BigNumber.ROUND_HALF_UP).toNumber(),
        code: displayCurrency,
      });
      return formatted;
    } catch (e) {
      return null;
    }
  }, [amount, sourceCoin, getRate, displayCurrency]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerShown: false,
      gestureEnabled: false, // Prevent swipe back
    });
  }, [navigation]);

  useEffect(() => {
    return () => {
      reset();
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [reset]);

  // Get target currency info
  const targetInfo = React.useMemo(() => {
    if (!targetCurrency) return { name: 'Unknown', ticker: '?', coinId: null };
    try {
      const coin = CoinDirectory.findCoinObj(targetCurrency);
      if (coin) return { name: coin.display_name, ticker: coin.display_ticker, coinId: coin.id };
    } catch (e) {}
    const displayName = getCurrencyDisplayName(targetCurrency, targetCurrency);
    return { name: displayName, ticker: displayName, coinId: null };
  }, [targetCurrency]);

  // Truncate address/txid for display
  const truncate = (str, startLen = 10, endLen = 8) => {
    if (!str || str.length <= startLen + endLen + 3) return str;
    return `${str.substring(0, startLen)}...${str.substring(str.length - endLen)}`;
  };

  // Copy txid to clipboard with visual feedback
  const handleCopyTxId = useCallback(() => {
    if (txResult?.txid) {
      Clipboard.setString(txResult.txid);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  }, [txResult]);

  // Navigate back to Wallet screen
  const handleDone = useCallback(() => {
    const parent = navigation.getParent?.();
    if (parent && typeof parent.reset === 'function') {
      parent.reset({
        index: 0,
        routes: [{ name: 'Home', params: { screen: 'WalletHome' } }],
      });
      return;
    }
    navigation.navigate('Home', { screen: 'WalletHome' });
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Success content */}
      <View style={styles.content}>
        {/* Checkmark animation */}
        <View style={styles.checkmarkContainer}>
          <AnimatedSuccessCheckmark style={styles.checkmark} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Transaction sent!</Text>
        <Text style={styles.subtitle}>Your transaction has been submitted to the network</Text>

        {/* Amount summary */}
        <View style={styles.summaryCard}>
          {/* Sent amount */}
          <View style={styles.amountRow}>
            {sourceCoin && RenderSquareCoinLogo(sourceCoin.id, { marginRight: 12 }, 36, 36)}
            <View style={{ flex: 1 }}>
              <Text style={styles.amountLabel}>Sent</Text>
              <Text style={styles.amountValue}>
                {amount} {sourceCoin?.display_ticker}
              </Text>
              {amountFiatDisplay && (
                <Text style={styles.amountFiat}>{amountFiatDisplay}</Text>
              )}
            </View>
          </View>

          {/* Conversion result */}
          {isConversion && (
            <>
              <View style={styles.arrowContainer}>
                <MaterialCommunityIcons name="arrow-down" size={20} color="#CCC" />
              </View>
              <View style={styles.amountRow}>
                {targetInfo.coinId ? (
                  RenderSquareCoinLogo(targetInfo.coinId, { marginRight: 12 }, 36, 36)
                ) : (
                  <View style={styles.placeholderLogo}>
                    <Text style={styles.placeholderText}>
                      {(targetInfo.ticker || '?').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.amountLabel}>You'll receive approx.</Text>
                  <Text style={styles.amountValue}>
                    ~{estimate?.estimatedcurrencyout
                      ? BigNumber(estimate.estimatedcurrencyout).decimalPlaces(8).toString()
                      : '?'} {targetInfo.ticker}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Recipient */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>To</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {recipientAddress?.endsWith('@') ? recipientAddress : truncate(recipientAddress)}
            </Text>
          </View>

          {/* Transaction ID */}
          {txResult?.txid && (
            <TouchableOpacity 
              style={styles.detailRow} 
              onPress={handleCopyTxId}
              activeOpacity={0.7}
            >
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <View style={styles.txIdRow}>
                <Text style={styles.detailValueMono} numberOfLines={1}>
                  {truncate(txResult.txid, 8, 6)}
                </Text>
                {copied ? (
                  <Text style={styles.copiedLabel}>Copied</Text>
                ) : (
                  <MaterialCommunityIcons name="content-copy" size={16} color={Colors.primaryColor} style={{ marginLeft: 6 }} />
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Info note */}
        <Text style={styles.infoNote}>
          It may take a few minutes for this transaction to be confirmed on the network.
        </Text>
      </View>

      {/* Done Button */}
      <View style={styles.buttonContainer}>
        <GradientButton onPress={handleDone}>
          Done
        </GradientButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  checkmarkContainer: {
    marginBottom: 20,
  },
  checkmark: {
    width: 90,
    height: 90,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 2,
  },
  amountFiat: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  placeholderLogo: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  detailLabel: {
    fontSize: 14,
    color: '#888',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailValueMono: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  txIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copiedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryColor,
    marginLeft: 6,
  },
  infoNote: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    backgroundColor: 'white',
  },
});

export default SendWizardSuccess;

