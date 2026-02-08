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
  - Updated 2026-01-22: Enhanced success screen to show transaction type context.
    For bridge/cross-chain transactions: shows destination network, expected arrival time,
    and "what happens next" messaging. For conversions: shows receiving currency clearly.
    Uses same transaction type detection logic as confirm screen for consistency.
  - Updated 2026-01-22: Fixed grey placeholder icons by adding currencyId field to targetInfo
    and using it as fallback for icon rendering. Coins without CoinDirectory entries
    now show algorithmically generated mosaic icons.
  - Updated 2026-01-22: Fixed "Expected arrival" time text wrapping issue by removing
    maxWidth constraint on time value text (detailValueNoWrap style).
  - Updated 2026-02-08: Success screen now uses adjusted preflight amount and
    recalculates receive estimate when fees reduce the send amount.
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
import { getCurrencyDisplayName, getNetworkDisplayName } from './sendWizardDisplayInfo';
import GradientButton from '../../components/GradientButton';
import AnimatedSuccessCheckmark from '../../components/AnimatedSuccessCheckmark';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { satsToCoins } from '../../utils/math';
import { GENERAL, WYRE_SERVICE, USD, ETH, ERC20 } from '../../utils/constants/intervalConstants';

const SendWizardSuccess = () => {
  const navigation = useNavigation();
  const { state, reset } = useSendWizard();
  const {
    sourceCoin,
    targetCurrency,
    isConversion,
    isCrossChain,
    exportTo,
    targetDisplayName,
    targetDisplayTicker,
    amount,
    via,
    viaOptions,
    estimate,
    preflightResult,
    recipientAddress,
    txResult,
    channel,
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

  // Prefer preflight estimate for more accurate receive amounts
  // If the amount was adjusted during preflight, recalculate the estimate using the adjusted amount.
  const displayEstimate = useMemo(() => {
    let baseEstimate = preflightResult?.estimate || estimate || null;
    
    // Check if amount was adjusted (fees deducted from send amount)
    if (preflightResult?.output?.satoshis && 
        preflightResult?.submittedsats && 
        baseEstimate?.estimatedcurrencyout &&
        viaOptions?.length > 0) {
      
      const submitted = BigNumber(preflightResult.submittedsats);
      const actual = BigNumber(preflightResult.output.satoshis);
      
      // Only recalculate if amount was actually adjusted
      if (!submitted.isEqualTo(actual)) {
        // Find the selected via option (or direct option if no via)
        const selectedViaOption = viaOptions.find(opt => 
          via ? opt.id === via : (opt.isDirect || opt.id === 'direct')
        );
        
        // If we have a price, recalculate the estimate using the adjusted amount
        if (selectedViaOption?.price) {
          const adjustedAmountBn = satsToCoins(actual);
          const priceBn = BigNumber(selectedViaOption.price);
          
          if (priceBn.isFinite() && !priceBn.isNaN() && priceBn.isGreaterThan(0)) {
            const recalculatedOutput = adjustedAmountBn.multipliedBy(priceBn);
            
            return {
              ...baseEstimate,
              estimatedcurrencyout: recalculatedOutput.toString(),
              precomputed: true,
              recalculated: true, // Flag to indicate this was recalculated
            };
          }
        }
      }
    }
    
    return baseEstimate;
  }, [preflightResult, estimate, viaOptions, via]);

  // Use adjusted amount from preflight when fees are deducted from the send amount
  const displayAmount = useMemo(() => {
    if (preflightResult?.output?.satoshis && preflightResult?.submittedsats) {
      const submitted = BigNumber(preflightResult.submittedsats);
      const actual = BigNumber(preflightResult.output.satoshis);
      
      if (!submitted.isEqualTo(actual)) {
        // Amount was adjusted - show the actual amount that will be sent
        return satsToCoins(actual).toString();
      }
    }
    return amount;
  }, [preflightResult, amount]);

  // Calculate fiat display for amount
  const amountFiatDisplay = useMemo(() => {
    if (!displayAmount || !sourceCoin?.id) return null;
    const rate = getRate(sourceCoin.id);
    if (!rate) return null;
    try {
      const fiatValue = BigNumber(displayAmount).multipliedBy(BigNumber(rate));
      if (fiatValue.isNaN() || !fiatValue.isFinite()) return null;
      const [formatted] = formatCurrency({
        amount: fiatValue.decimalPlaces(2, BigNumber.ROUND_HALF_UP).toNumber(),
        code: displayCurrency,
      });
      return formatted;
    } catch (e) {
      return null;
    }
  }, [displayAmount, sourceCoin, getRate, displayCurrency]);

  // Get channel type for transaction type detection
  const channelType = useMemo(() => {
    if (!channel) return null;
    return channel.split('.')[0];
  }, [channel]);

  // Determine if this is a simple send (no conversion, no cross-chain)
  const isSimpleSend = useMemo(() => {
    return !isConversion && !isCrossChain && !exportTo;
  }, [isConversion, isCrossChain, exportTo]);

  // Calculate estimated time until arrival based on transaction type
  // Mirrors logic from SendWizardConfirm.js for consistency
  const estimatedTime = useMemo(() => {
    // ETH/ERC20 on-chain conversion (bridge from Ethereum to Verus)
    if ((channelType === ETH || channelType === ERC20) && isConversion && !exportTo) {
      return '1-3 hours';
    }

    // Cross-chain transfer (exportto is set)
    if (isCrossChain && exportTo) {
      return '1-3 hours';
    }

    // Regular conversion on Verus (PBaaS conversion)
    if (isConversion && !exportTo) {
      return '2-10 minutes';
    }

    // Simple send (no conversion, no cross-chain)
    if (isSimpleSend) {
      return '1-5 minutes';
    }

    return null;
  }, [channelType, isConversion, isCrossChain, exportTo, isSimpleSend]);

  // Flag for bridge transactions (1-3 hour estimate)
  const isBridgeTransaction = useMemo(() => {
    return estimatedTime === '1-3 hours';
  }, [estimatedTime]);

  // Flag for PBaaS conversions (2-10 minute estimate)
  const isPbaasConversion = useMemo(() => {
    return estimatedTime === '2-10 minutes';
  }, [estimatedTime]);

  // Get destination network display name for cross-chain transactions
  const destinationNetworkName = useMemo(() => {
    if (!exportTo) return null;
    return getNetworkDisplayName(exportTo, null);
  }, [exportTo]);

  // Get contextual "what happens next" message based on transaction type
  const whatsNextMessage = useMemo(() => {
    if (isBridgeTransaction) {
      return 'Your transaction is being verified by the Verus-Ethereum Bridge. This process takes usually 1-4 hours for security.';
    }
    if (isPbaasConversion) {
      return 'Your conversion will be processed in the next 2-10 blocks.';
    }
    return 'It may take a few minutes for this transaction to be confirmed on the network.';
  }, [isBridgeTransaction, isPbaasConversion]);

  // Get title based on transaction type
  const successTitle = useMemo(() => {
    if (isBridgeTransaction) {
      return 'Bridge transaction sent!';
    }
    if (isConversion) {
      return 'Conversion sent!';
    }
    return 'Transaction sent!';
  }, [isBridgeTransaction, isConversion]);

  // Get subtitle based on transaction type
  const successSubtitle = useMemo(() => {
    if (isBridgeTransaction && destinationNetworkName) {
      return `Your transaction is on its way to ${destinationNetworkName}`;
    }
    if (isConversion) {
      return 'Your conversion has been submitted to the network';
    }
    return 'Your transaction has been submitted to the network';
  }, [isBridgeTransaction, isConversion, destinationNetworkName]);

  // Get label for sent amount based on transaction type
  const sentLabel = useMemo(() => {
    if (isBridgeTransaction) {
      return 'Bridging';
    }
    if (isConversion) {
      return 'Converting';
    }
    return 'Sent';
  }, [isBridgeTransaction, isConversion]);

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

  // Get target currency info - prefer display names from context, then lookup
  const targetInfo = useMemo(() => {
    // Prefer display labels captured during path selection (never show vUSDC.vETH / i-addresses)
    if (targetDisplayName || targetDisplayTicker) {
      let coinId = null;
      try {
        const coin = CoinDirectory.findCoinObj(targetCurrency);
        if (coin) coinId = coin.id;
      } catch (e) {}
      
      return {
        name: targetDisplayName || targetDisplayTicker || 'Unknown',
        ticker: targetDisplayTicker || targetDisplayName || '?',
        coinId,
        currencyId: targetCurrency, // Keep original ID for icon fallback
      };
    }
    
    // Fallback to lookup
    if (!targetCurrency) return { name: 'Unknown', ticker: '?', coinId: null, currencyId: null };
    try {
      const coin = CoinDirectory.findCoinObj(targetCurrency);
      if (coin) return { name: coin.display_name, ticker: coin.display_ticker, coinId: coin.id, currencyId: targetCurrency };
    } catch (e) {}
    const displayName = getCurrencyDisplayName(targetCurrency, targetCurrency);
    return { name: displayName, ticker: displayName, coinId: null, currencyId: targetCurrency };
  }, [targetCurrency, targetDisplayName, targetDisplayTicker]);

  // Calculate fiat display for receive amount
  const receiveFiatDisplay = useMemo(() => {
    if (!displayEstimate?.estimatedcurrencyout) return null;
    const targetCoinId = targetInfo?.coinId;
    if (!targetCoinId) return null;
    const rate = getRate(targetCoinId);
    if (!rate) return null;
    try {
      const fiatValue = BigNumber(displayEstimate.estimatedcurrencyout).multipliedBy(BigNumber(rate));
      if (fiatValue.isNaN() || !fiatValue.isFinite()) return null;
      const [formatted] = formatCurrency({
        amount: fiatValue.decimalPlaces(2, BigNumber.ROUND_HALF_UP).toNumber(),
        code: displayCurrency,
      });
      return formatted;
    } catch (e) {
      return null;
    }
  }, [displayEstimate, targetInfo, getRate, displayCurrency]);

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
        <Text style={styles.title}>{successTitle}</Text>
        <Text style={styles.subtitle}>{successSubtitle}</Text>

        {/* Amount summary */}
        <View style={styles.summaryCard}>
          {/* Sent/Bridging/Converting amount */}
          <View style={styles.amountRow}>
            {sourceCoin && RenderSquareCoinLogo(sourceCoin.id, { marginRight: 12 }, 36, 36)}
            <View style={{ flex: 1 }}>
              <Text style={styles.amountLabel}>{sentLabel}</Text>
              <Text style={styles.amountValue}>
                {displayAmount} {sourceCoin?.display_ticker}
              </Text>
              {amountFiatDisplay && (
                <Text style={styles.amountFiat}>{amountFiatDisplay}</Text>
              )}
            </View>
          </View>

          {/* Conversion/Bridge result - show what user will receive */}
          {isConversion && (
            <>
              <View style={styles.arrowContainer}>
                <MaterialCommunityIcons name="arrow-down" size={20} color="#CCC" />
              </View>
              <View style={styles.amountRow}>
                {/* Use coinId if available, otherwise fall back to currencyId for mosaic generation */}
                {RenderSquareCoinLogo(targetInfo.coinId || targetInfo.currencyId, { marginRight: 12 }, 36, 36)}
                <View style={{ flex: 1 }}>
                  <Text style={styles.amountLabel}>You'll receive</Text>
                  <Text style={styles.amountValue}>
                    ~{displayEstimate?.estimatedcurrencyout
                      ? BigNumber(displayEstimate.estimatedcurrencyout).decimalPlaces(8).toString()
                      : '?'} {targetInfo.ticker}
                  </Text>
                  {receiveFiatDisplay && (
                    <Text style={styles.amountFiat}>~{receiveFiatDisplay}</Text>
                  )}
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

          {/* Destination network for cross-chain */}
          {destinationNetworkName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue}>{destinationNetworkName}</Text>
            </View>
          )}

          {/* Estimated arrival time */}
          {estimatedTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expected arrival</Text>
              <View style={styles.estimatedTimeContainer}>
                {isBridgeTransaction && (
                  <MaterialCommunityIcons 
                    name="timer-sand" 
                    size={14} 
                    color="#888"
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text style={styles.detailValueNoWrap}>
                  {estimatedTime}
                </Text>
              </View>
            </View>
          )}

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

        {/* Contextual info note */}
        <Text style={styles.infoNote}>
          {whatsNextMessage}
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
  detailValueNoWrap: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
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
  estimatedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
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

