/*
  SendWizardAmount
  - Step 3: Enter amount and select routing (via) for conversions
  - Shows conversion estimate when applicable
  - Allows manual via override via sheet
  - Created 2024-12-09
  - Updated 2024-12-09: Fetches estimates for ALL via options when amount is entered,
    auto-selects best route (highest output), passes estimates to via sheet
  - Updated 2024-12-10: Redesigned with GradientButton, auto-focus input, 
    compact estimate with rate, improved subtitle with chain info
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput as RNTextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import Colors from '../../globals/colors';
import BigNumber from 'bignumber.js';
import { useSendWizard } from './SendWizardContext';
import { estimateConversion } from '../../utils/api/channels/vrpc/requests/estimateConversion';
import { coinsToSats } from '../../utils/math';
import SendViaSheet from './components/SendViaSheet';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import GradientButton from '../../components/GradientButton';
import { getNetworkDisplayName } from './sendWizardDisplayInfo';

const SendWizardAmount = () => {
  const navigation = useNavigation();
  const { state, setAmount, setVia, setEstimate, setStep } = useSendWizard();
  const {
    sourceCoin,
    sourceBalance,
    targetCurrency,
    exportTo,
    isConversion,
    isCrossChain,
    via,
    viaOptions,
    estimate,
  } = state;

  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(null);
  const [viaSheetVisible, setViaSheetVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  // Store estimates for all via options to display in sheet and auto-select best
  const [viaEstimates, setViaEstimates] = useState({});

  // Auto-focus the input when screen mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => null,
      headerBackTitle: 'Back',
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: 'white',
        elevation: 0,
        shadowOpacity: 0,
      },
    });
  }, [navigation]);

  // Parse amount and validate
  const parsedAmount = useMemo(() => {
    if (!inputValue || inputValue.trim() === '') return null;
    try {
      const bn = BigNumber(inputValue);
      if (bn.isNaN() || bn.isLessThanOrEqualTo(0)) return null;
      return bn;
    } catch (e) {
      return null;
    }
  }, [inputValue]);

  const amountSats = useMemo(() => {
    if (!parsedAmount) return null;
    return coinsToSats(parsedAmount).toString();
  }, [parsedAmount]);

  const balanceBn = useMemo(() => {
    if (sourceBalance == null) return BigNumber(0);
    return BigNumber(sourceBalance);
  }, [sourceBalance]);

  const isOverBalance = useMemo(() => {
    if (!parsedAmount) return false;
    return parsedAmount.isGreaterThan(balanceBn);
  }, [parsedAmount, balanceBn]);

  const isValidAmount = useMemo(() => {
    return parsedAmount != null && !isOverBalance;
  }, [parsedAmount, isOverBalance]);

  // Fetch estimates for ALL via options when amount changes
  // Then auto-select the best one (highest output)
  // For direct conversions (no via needed), fetch estimate without via
  useEffect(() => {
    const fetchAllEstimates = async () => {
      if (!isConversion || !parsedAmount || !targetCurrency || !sourceCoin) {
        setEstimate(null);
        setViaEstimates({});
        return;
      }

      setEstimateLoading(true);
      setEstimateError(null);

      const systemId = sourceCoin.system_id || sourceCoin.id;
      const currency = sourceCoin.currency_id || sourceCoin.id;
      const amount = parsedAmount.toNumber();

      // Filter to get valid via options (exclude 'direct')
      const validViaOptions = (viaOptions || []).filter(
        opt => opt.id && opt.id !== 'direct' && !opt.isDirect
      );

      // If no via options, this is a direct conversion - fetch estimate without via
      if (validViaOptions.length === 0) {
        try {
          const result = await estimateConversion(
            systemId,
            currency,
            targetCurrency,
            amount,
            null, // no via for direct conversion
            false
          );

          if (result.error) {
            setEstimateError(result.error.message || 'Estimate failed');
            setEstimate(null);
          } else if (result.result) {
            setEstimate(result.result);
            setVia(null); // Direct conversion, no via
          }
        } catch (e) {
          console.warn('Direct estimate error:', e);
          setEstimateError(e.message || 'Failed to get estimate');
        }
        setEstimateLoading(false);
        return;
      }

      // Fetch estimates for all via options in parallel
      const estimatePromises = validViaOptions.map(async (opt) => {
        try {
          const result = await estimateConversion(
            systemId,
            currency,
            targetCurrency,
            amount,
            opt.id,
            false // preconvert
          );
          return { viaId: opt.id, result };
        } catch (e) {
          console.warn(`Estimate error for ${opt.id}:`, e);
          return { viaId: opt.id, error: e.message };
        }
      });

      try {
        const results = await Promise.all(estimatePromises);
        
        // Build estimates map and find best option
        const newEstimates = {};
        let bestVia = null;
        let bestOutput = BigNumber(0);

        for (const { viaId, result, error } of results) {
          if (error || result?.error) {
            newEstimates[viaId] = { error: error || result?.error?.message };
          } else if (result?.result) {
            const output = BigNumber(result.result.estimatedcurrencyout || 0);
            newEstimates[viaId] = {
              estimate: result.result,
              output: output.toString(),
            };
            
            // Track best option
            if (output.isGreaterThan(bestOutput)) {
              bestOutput = output;
              bestVia = viaId;
            }
          }
        }

        setViaEstimates(newEstimates);

        // Auto-select best via and set its estimate
        if (bestVia && newEstimates[bestVia]?.estimate) {
          setVia(bestVia);
          setEstimate(newEstimates[bestVia].estimate);
        } else {
          // No successful estimates from via options, try direct
          try {
            const directResult = await estimateConversion(
              systemId,
              currency,
              targetCurrency,
              amount,
              null,
              false
            );
            if (directResult.result) {
              setEstimate(directResult.result);
              setVia(null);
            } else {
              setEstimateError('Could not estimate conversion');
            }
          } catch (e) {
            setEstimateError('Could not estimate conversion for any route');
          }
        }
      } catch (e) {
        console.warn('Error fetching estimates:', e);
        setEstimateError('Failed to get conversion estimates');
      }

      setEstimateLoading(false);
    };

    // Debounce the estimate calls
    const timer = setTimeout(fetchAllEstimates, 500);
    return () => clearTimeout(timer);
  }, [parsedAmount, targetCurrency, viaOptions, isConversion, sourceCoin, setVia, setEstimate]);

  // Update estimate when user manually changes via selection
  useEffect(() => {
    if (via && viaEstimates[via]?.estimate) {
      setEstimate(viaEstimates[via].estimate);
    }
  }, [via, viaEstimates, setEstimate]);

  const handleMaxPress = useCallback(() => {
    if (balanceBn.isGreaterThan(0)) {
      setInputValue(balanceBn.toString());
    }
  }, [balanceBn]);

  const handleContinue = useCallback(() => {
    if (!isValidAmount) return;

    setAmount(inputValue, amountSats);
    setStep(4);
    navigation.navigate('SendWizardRecipient');
  }, [isValidAmount, inputValue, amountSats, setAmount, setStep, navigation]);

  const handleViaSelect = useCallback(
    (selectedVia) => {
      setVia(selectedVia);
      setViaSheetVisible(false);
    },
    [setVia],
  );

  // Get target currency display info
  const targetCurrencyInfo = useMemo(() => {
    if (!targetCurrency) return { name: 'Unknown', ticker: '?' };
    try {
      const coin = CoinDirectory.findCoinObj(targetCurrency);
      if (coin) return { name: coin.display_name, ticker: coin.display_ticker, coinId: coin.id };
    } catch (e) {}
    return { name: targetCurrency, ticker: targetCurrency, coinId: null };
  }, [targetCurrency]);

  // Get source and destination chain names for subtitle
  // Note: The vETH system is a Verus pBaaS chain, so when staying on-chain, we display "Verus"
  const chainInfo = useMemo(() => {
    const VETH_SYSTEM_ID = 'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X';
    const sourceSystemId = sourceCoin?.system_id || sourceCoin?.id;
    
    // When staying on-chain (not cross-chain), always show "Verus" for any Verus-based chain
    // The vETH system is a pBaaS chain on Verus, not Ethereum
    let sourceChain = 'Verus';
    if (sourceSystemId && sourceSystemId !== VETH_SYSTEM_ID) {
      sourceChain = getNetworkDisplayName(sourceSystemId, 'Verus');
    }
    
    let destChain = sourceChain; // Same chain by default
    let isSameChain = true;
    
    if (isCrossChain && exportTo) {
      // Cross-chain: show the actual destination
      destChain = getNetworkDisplayName(exportTo, exportTo);
      isSameChain = false;
    }
    
    return { sourceChain, destChain, isSameChain };
  }, [sourceCoin, exportTo, isCrossChain]);

  // Get display name for current via option
  const currentViaDisplayName = useMemo(() => {
    if (!via) return null;
    
    // First try to find in viaOptions
    const viaOpt = viaOptions?.find(v => v.id === via);
    if (viaOpt?.name && viaOpt.name !== viaOpt.id) {
      return viaOpt.name;
    }
    
    // Try to look up in CoinDirectory
    try {
      const coin = CoinDirectory.findCoinObj(via);
      if (coin) return coin.display_name;
    } catch (e) {}
    
    // Fallback to the name from viaOptions or truncated ID
    if (viaOpt?.name) return viaOpt.name;
    return via.length > 12 ? `${via.substring(0, 8)}...` : via;
  }, [via, viaOptions]);

  // Format estimate output and calculate rate
  const { estimateDisplay, rateDisplay } = useMemo(() => {
    if (!estimate || !estimate.estimatedcurrencyout) {
      return { estimateDisplay: null, rateDisplay: null };
    }
    const outAmount = BigNumber(estimate.estimatedcurrencyout);
    const formattedOutput = outAmount.decimalPlaces(8).toString();
    
    // Calculate rate from input/output amounts
    let rate = null;
    if (parsedAmount && parsedAmount.isGreaterThan(0) && outAmount.isGreaterThan(0)) {
      rate = outAmount.dividedBy(parsedAmount).decimalPlaces(6).toString();
    }
    
    return { estimateDisplay: formattedOutput, rateDisplay: rate };
  }, [estimate, parsedAmount]);

  // Build the subtitle text with chain info
  const subtitleText = useMemo(() => {
    if (isConversion) {
      if (chainInfo.isSameChain) {
        return `Convert ${sourceCoin?.display_ticker} → ${targetCurrencyInfo.ticker} on ${chainInfo.sourceChain}`;
      } else {
        return `Convert ${sourceCoin?.display_ticker} → ${targetCurrencyInfo.ticker} to ${chainInfo.destChain}`;
      }
    } else {
      if (chainInfo.isSameChain) {
        return `Send ${sourceCoin?.display_ticker} on ${chainInfo.sourceChain}`;
      } else {
        return `Send ${sourceCoin?.display_ticker} from ${chainInfo.sourceChain} to ${chainInfo.destChain}`;
      }
    }
  }, [isConversion, sourceCoin, targetCurrencyInfo, chainInfo]);

  if (!sourceCoin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#666' }}>No source currency selected.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Main content area */}
      <View style={styles.contentArea}>
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.mainTitle}>Enter amount</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>

          {/* Amount Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <RNTextInput
                ref={inputRef}
                value={inputValue}
                onChangeText={setInputValue}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
                autoCorrect={false}
                style={[
                  styles.amountInput,
                  inputFocused && styles.amountInputFocused,
                  isOverBalance && styles.amountInputError,
                ]}
              />
              <Text style={styles.tickerLabel}>{sourceCoin.display_ticker}</Text>
            </View>

            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, isOverBalance && styles.balanceLabelError]}>
                Available: {balanceBn.decimalPlaces(4).toString()} {sourceCoin.display_ticker}
              </Text>
              <TouchableOpacity 
                onPress={handleMaxPress}
                style={[styles.maxButton, isOverBalance && styles.maxButtonError]}
                activeOpacity={0.7}
              >
                <Text style={[styles.maxButtonText, isOverBalance && styles.maxButtonTextError]}>
                  MAX
                </Text>
              </TouchableOpacity>
            </View>

            {isOverBalance && (
              <Text style={styles.errorText}>Amount exceeds available balance</Text>
            )}
          </View>

          {/* Conversion Estimate - compact version */}
          {isConversion && (
            <View style={styles.estimateContainer}>
              {estimateLoading ? (
                <View style={styles.estimateRowCompact}>
                  <ActivityIndicator size="small" color={Colors.primaryColor} />
                  <Text style={styles.estimateLoading}>Calculating...</Text>
                </View>
              ) : estimateError ? (
                <Text style={styles.estimateError}>{estimateError}</Text>
              ) : estimateDisplay ? (
                <>
                  {/* Estimate output row */}
                  <View style={styles.estimateRowCompact}>
                    {targetCurrencyInfo.coinId && (
                      <View style={{ marginRight: 10 }}>
                        {RenderSquareCoinLogo(targetCurrencyInfo.coinId, {}, 28, 28)}
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.estimateMainRow}>
                        <Text style={styles.estimateAmountCompact}>
                          ≈ {estimateDisplay}
                        </Text>
                        <Text style={styles.estimateTickerCompact}>
                          {targetCurrencyInfo.ticker}
                        </Text>
                      </View>
                      {rateDisplay && (
                        <Text style={styles.estimateRateCompact}>
                          1 {sourceCoin.display_ticker} = {rateDisplay} {targetCurrencyInfo.ticker}
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* Via selector on separate row */}
                  {via && viaOptions && viaOptions.length > 1 && (
                    <TouchableOpacity
                      style={styles.viaSelectorRow}
                      onPress={() => setViaSheetVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viaLabelRow}>Route via</Text>
                      <View style={styles.viaValueRow}>
                        <Text style={styles.viaValueText}>{currentViaDisplayName}</Text>
                        <Text style={styles.viaChevronRow}>›</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {/* Via route display for single option */}
                  {via && viaOptions && viaOptions.length === 1 && (
                    <View style={styles.viaSingleRow}>
                      <Text style={styles.viaSingleLabel}>Route via</Text>
                      <Text style={styles.viaSingleValue}>{currentViaDisplayName}</Text>
                    </View>
                  )}
                </>
              ) : parsedAmount ? (
                <Text style={styles.estimateEmpty}>Calculating estimate...</Text>
              ) : (
                <Text style={styles.estimateEmpty}>Enter amount to see estimate</Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Continue Button - positioned above keyboard */}
      <View style={styles.buttonContainer}>
        <GradientButton
          onPress={handleContinue}
          disabled={!isValidAmount}
          style={styles.continueButton}
        >
          Continue
        </GradientButton>
      </View>

      {/* Via Sheet */}
      {viaSheetVisible && (
        <SendViaSheet
          visible={viaSheetVisible}
          viaOptions={viaOptions}
          viaEstimates={viaEstimates}
          currentVia={via}
          targetTicker={targetCurrencyInfo.ticker}
          sourceTicker={sourceCoin?.display_ticker}
          inputAmount={parsedAmount?.toString()}
          onClose={() => setViaSheetVisible(false)}
          onSelect={handleViaSelect}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentArea: {
    flex: 1,
    paddingTop: 8,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 4,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    backgroundColor: '#F5F5F5',
  },
  amountInputFocused: {
    borderColor: Colors.primaryColor,
    backgroundColor: '#FFFFFF',
  },
  amountInputError: {
    borderColor: '#FF4444',
    backgroundColor: '#FFF8F8',
  },
  tickerLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginLeft: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#888',
  },
  balanceLabelError: {
    color: '#FF4444',
  },
  // MAX button styled like ValuOffRamp
  maxButton: {
    backgroundColor: Colors.primaryColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  maxButtonError: {
    backgroundColor: '#FF4444',
  },
  maxButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.secondaryColor,
    letterSpacing: 0.5,
  },
  maxButtonTextError: {
    color: 'white',
  },
  errorText: {
    fontSize: 13,
    color: '#FF4444',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  // Compact estimate container
  estimateContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  estimateRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estimateMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  estimateAmountCompact: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  estimateTickerCompact: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 6,
  },
  estimateRateCompact: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  estimateLoading: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  estimateError: {
    fontSize: 14,
    color: '#FF4444',
  },
  estimateEmpty: {
    fontSize: 14,
    color: '#999',
  },
  // Via selector on separate row (tappable, multiple options)
  viaSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  viaLabelRow: {
    fontSize: 13,
    color: '#888',
  },
  viaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viaValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryColor,
  },
  viaChevronRow: {
    fontSize: 16,
    color: '#888',
    marginLeft: 4,
  },
  // Single via route display (non-tappable)
  viaSingleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  viaSingleLabel: {
    fontSize: 13,
    color: '#888',
  },
  viaSingleValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 28,
    backgroundColor: 'white',
  },
  continueButton: {
    borderRadius: 24,
  },
});

export default SendWizardAmount;

