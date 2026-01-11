/*
  SendWizardConfirm
  - Step 5: Overview and confirmation of transaction
  - Runs preflight to validate and get fee info
  - Shows summary including fees, conversion rates, warnings
  - Created 2024-12-09
  - Updated 2024-12-15: Redesigned with cleaner layout, GradientButton,
    proper fee display, navigates to success screen on completion
  - Updated 2024-12-17: Made amount section more compact - reduced padding,
    font sizes, logo sizes, and spacing for better screen utilization
  - Updated 2024-12-17: Added estimated time until arrival based on transaction type
    ETH/ERC20 conversions and cross-chain: 1-3 hours, Verus conversions: 2-10 minutes,
    Simple sends: 1-5 minutes. Not shown for preconvert transactions
  - Updated 2024-12-17: Fixed VerusID resolution for ETH/ERC20 by using the getIdentity
    router which correctly maps to the VRPC system (was using .eth as system ID)
  - Updated 2026-01-06: Confirm screen now prefers the preflight estimate (more accurate)
    but falls back to the wizard estimate (often derived from path.price). Avoids showing
    "no estimate" warnings when a fallback estimate exists.
  - Updated 2026-01-06: Preflight now uses preflight-friendly names (FQNs) captured during
    target selection (convertToFqn/exportToFqn), matching the legacy send modal and avoiding
    getCurrency failures when passing i-addresses for some PBaaS systems.
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, Button } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import Colors from '../../globals/colors';
import BigNumber from 'bignumber.js';
import { useSendWizard } from './SendWizardContext';
import { preflightConvertOrCrossChain } from '../../utils/api/routers/preflightConvertOrCrossChain';
import { preflightSend } from '../../utils/api/routers/preflightSend';
import { sendConvertOrCrossChain } from '../../utils/api/routers/sendConvertOrCrossChain';
import { send } from '../../utils/api/routers/send';
import { coinsToSats, satsToCoins } from '../../utils/math';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { expireCoinData } from '../../actions/actionCreators';
import { API_GET_BALANCES, API_GET_TRANSACTIONS, API_GET_FIATPRICE, VRPC, ETH, ERC20, ELECTRUM } from '../../utils/constants/intervalConstants';
import {
  DEST_PKH,
  DEST_ID,
  DEST_ETH,
  TransferDestination,
  fromBase58Check,
  I_ADDRESS_VERSION,
  R_ADDRESS_VERSION,
} from 'verus-typescript-primitives';
import { ethers } from 'ethers';
import { getIdentity } from '../../utils/api/routers/getIdentity';
import { getCurrencyDisplayName, getNetworkDisplayName } from './sendWizardDisplayInfo';
import GradientButton from '../../components/GradientButton';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const SendWizardConfirm = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { state, setPreflight, setLoading, reset, setTxResult } = useSendWizard();
  const {
    sourceCoin,
    sourceSubWallet,
    sourceBalance,
    targetCurrency,
    exportTo,
    isConversion,
    isCrossChain,
    mapTo,
    targetDisplayName,
    targetDisplayTicker,
    convertToFqn,
    exportToFqn,
    amount,
    amountSats,
    via,
    viaOptions,
    preconvert,
    recipientAddress,
    preflightResult,
    channel,
    estimate,
  } = state;

  const activeAccount = useObjectSelector((s) => s.authentication.activeAccount);

  const [loading, setLocalLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

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

  // Determine if this is a simple send or convert/cross-chain
  const isSimpleSend = useMemo(() => {
    return !isConversion && !isCrossChain && !exportTo;
  }, [isConversion, isCrossChain, exportTo]);

  const channelType = useMemo(() => {
    if (!channel) return null;
    return channel.split('.')[0];
  }, [channel]);

  // Calculate estimated time until arrival based on transaction type
  const estimatedTime = useMemo(() => {
    // Don't show time estimate for preconvert transactions
    if (preconvert) return null;

    // ETH/ERC20 on-chain conversion (convertto but no exportto)
    if ((channelType === ETH || channelType === ERC20) && isConversion && !exportTo) {
      return '1-3 hours';
    }

    // Cross-chain transfer (exportto is set)
    if (isCrossChain && exportTo) {
      return '1-3 hours';
    }

    // Regular conversion on Verus (convertto but no exportto)
    if (isConversion && !exportTo) {
      return '2-10 minutes';
    }

    // Simple send (no conversion, no cross-chain)
    if (isSimpleSend) {
      return '1-5 minutes';
    }

    return null;
  }, [channelType, isConversion, isCrossChain, exportTo, isSimpleSend, preconvert]);

  // Build destination from address
  const buildDestination = useCallback(async () => {
    const addr = recipientAddress.trim();

    // VerusID
    if (addr.endsWith('@')) {
      // Use the getIdentity router which correctly routes ETH/ERC20 to the VRPC system
      const identityRes = await getIdentity(sourceCoin, activeAccount, channel, addr);

      if (identityRes.error) {
        throw new Error(`Failed to get information about ${addr}. Try using the i-address of this VerusID.`);
      }

      const keyhash = identityRes.result.identity.identityaddress;
      const { hash } = fromBase58Check(keyhash);

      return new TransferDestination({
        destination_bytes: hash,
        type: DEST_ID,
      });
    }

    // ETH address
    if (addr.startsWith('0x') && ethers.isAddress(addr)) {
      return new TransferDestination({
        destination_bytes: Buffer.from(addr.substring(2), 'hex'),
        type: DEST_ETH,
      });
    }

    // Base58 address
    try {
      const { hash, version } = fromBase58Check(addr);
      let type;

      if (version === R_ADDRESS_VERSION) type = DEST_PKH;
      else if (version === I_ADDRESS_VERSION) type = DEST_ID;
      else type = DEST_PKH; // Default

      return new TransferDestination({
        destination_bytes: hash,
        type,
      });
    } catch (e) {
      throw new Error('Invalid address format');
    }
  }, [recipientAddress, sourceCoin, activeAccount, channel]);

  // Run preflight on mount
  useEffect(() => {
    const runPreflight = async () => {
      if (!sourceCoin || !channel || !recipientAddress || !amountSats) {
        setError('Missing required transaction data');
        setLocalLoading(false);
        return;
      }

      setLocalLoading(true);
      setError(null);
      setWarnings([]);

      try {
        let result;

        if (isSimpleSend) {
          // Simple send preflight
          result = await preflightSend(
            sourceCoin,
            activeAccount,
            recipientAddress,
            BigNumber(amount),
            channel,
            {}
          );
        } else {
          // Convert/cross-chain preflight
          const destination = await buildDestination();

          const output = {
            currency: sourceCoin.currency_id || sourceCoin.id,
            address: destination,
            satoshis: amountSats,
          };

          if (isConversion && targetCurrency) {
            // Use the legacy-style name/FQN when available to avoid getCurrency failures
            output.convertto = convertToFqn || targetCurrency;
          }

          if (isCrossChain && exportTo) {
            // Use the legacy-style name/FQN when available to avoid getCurrency failures
            output.exportto = exportToFqn || exportTo;
          }

          if (via) {
            // Legacy flow passes via as a currency name/FQN (not i-address) when possible
            const viaName = viaOptions?.find((v) => v.id === via)?.name;
            output.via = viaName || via;
          }

          if (mapTo) {
            output.mapto = mapTo;
          }

          if (preconvert) {
            output.preconvert = true;
          }

          result = await preflightConvertOrCrossChain(
            sourceCoin,
            activeAccount,
            channel,
            output
          );
        }

        if (result.err) {
          throw new Error(result.result);
        }

        setPreflight(result.result);

        // Check for warnings
        const newWarnings = [];

        if (result.result.converterdef?.proofprotocol === 2) {
          newWarnings.push({
            type: 'centralized',
            message: `You are converting to a centralized currency. The controller has the ability to mint new supply.`,
          });
        }

        // Only warn when we truly have no estimate (legacy flow falls back to path.price)
        const hasFallbackEstimate = estimate?.estimatedcurrencyout != null;
        if (result.result.estimate == null && isConversion && !hasFallbackEstimate) {
          newWarnings.push({
            type: 'no_estimate',
            message: 'Could not calculate an estimated result for this conversion.',
          });
        }

        // Check for slippage between earlier estimate and preflight estimate
        if (isConversion && estimate && result.result.estimate) {
          const earlierOutput = BigNumber(estimate.estimatedcurrencyout || 0);
          const preflightOutput = BigNumber(result.result.estimate.estimatedcurrencyout || 0);
          
          if (earlierOutput.isGreaterThan(0) && preflightOutput.isGreaterThan(0)) {
            const slippage = earlierOutput.minus(preflightOutput).dividedBy(earlierOutput).multipliedBy(100);
            
            // Warn if slippage is more than 2%
            if (slippage.isGreaterThan(2)) {
              newWarnings.push({
                type: 'slippage',
                message: `Due to low liquidity, the estimated amount you will receive differs by ${slippage.decimalPlaces(1).toString()}% from the earlier estimate. Verify the new amount before continuing.`,
              });
            }
          }
        }

        // Check for amount adjustment (fee taken from amount)
        if (result.result.submittedsats && result.result.output?.satoshis) {
          const submitted = BigNumber(result.result.submittedsats);
          const actual = BigNumber(result.result.output.satoshis);
          
          if (!submitted.isEqualTo(actual)) {
            newWarnings.push({
              type: 'amount_adjusted',
              message: `Your amount was adjusted from ${satsToCoins(submitted).toString()} to ${satsToCoins(actual).toString()} to account for transaction fees.`,
            });
          }
        }

        setWarnings(newWarnings);
      } catch (e) {
        console.error('Preflight error:', e);
        setError(e.message || 'Failed to prepare transaction');
      }

      setLocalLoading(false);
    };

    runPreflight();
  }, [
    sourceCoin,
    channel,
    recipientAddress,
    amountSats,
    isSimpleSend,
    activeAccount,
    amount,
    buildDestination,
    isConversion,
    targetCurrency,
    isCrossChain,
    exportTo,
    via,
    mapTo,
    preconvert,
    setPreflight,
  ]);
  
  // Prefer the preflight estimate (more accurate). Fall back to the earlier wizard estimate.
  const displayEstimate = useMemo(() => {
    return preflightResult?.estimate || estimate || null;
  }, [preflightResult, estimate]);

  // Get currency info for display
  const getCurrencyInfo = useCallback((currencyId, optionalViaOptions = null) => {
    if (!currencyId) return { name: 'Unknown', ticker: '?', coinId: null };
    
    try {
      const coin = CoinDirectory.findCoinObj(currencyId);
      if (coin) return { name: coin.display_name, ticker: coin.display_ticker, coinId: coin.id };
    } catch (e) {}
    
    const viaOpts = optionalViaOptions || viaOptions;
    if (viaOpts) {
      const viaOpt = viaOpts.find(v => v.id === currencyId);
      if (viaOpt?.name && viaOpt.name !== currencyId) {
        return { name: viaOpt.name, ticker: viaOpt.name, coinId: null };
      }
    }
    
    const displayName = getCurrencyDisplayName(currencyId, null);
    if (displayName && displayName !== currencyId) {
      return { name: displayName, ticker: displayName, coinId: null };
    }
    
    const name = currencyId.length > 16 ? `${currencyId.substring(0, 8)}...${currencyId.slice(-6)}` : currencyId;
    return { name, ticker: name, coinId: null };
  }, [viaOptions]);

  const targetInfo = useMemo(() => {
    // Prefer display labels captured from conversion paths (never show vUSDC.vETH / i-addresses)
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
      };
    }
    
    return getCurrencyInfo(targetCurrency);
  }, [targetCurrency, getCurrencyInfo, targetDisplayName, targetDisplayTicker]);

  // Extract fee information from preflight result
  const feeInfo = useMemo(() => {
    if (!preflightResult) return null;

    // Simple send - fee is directly available
    if (preflightResult.fee) {
      return {
        amount: preflightResult.fee,
        currency: preflightResult.feeCurr || sourceCoin?.display_ticker || 'VRSC',
      };
    }

    // Convert/cross-chain - fee might be in validation.fees
    if (preflightResult.validation?.fees) {
      const fees = preflightResult.validation.fees;
      const systemId = sourceCoin?.system_id || sourceCoin?.id;
      
      for (const currencyId of Object.keys(fees)) {
        const feeSats = BigNumber(fees[currencyId]);
        if (feeSats.isGreaterThan(0)) {
          const feeCoins = satsToCoins(feeSats).decimalPlaces(8).toString();
          // Try to get friendly name for fee currency
          let feeCurrName = currencyId;
          try {
            const coin = CoinDirectory.findCoinObj(currencyId);
            if (coin) feeCurrName = coin.display_ticker;
          } catch (e) {
            feeCurrName = getCurrencyDisplayName(currencyId, currencyId);
          }
          return { amount: feeCoins, currency: feeCurrName };
        }
      }
    }

    // Fallback - calculate from nativeFeesPaid if available
    if (preflightResult.nativeFeesPaid) {
      const feeCoins = satsToCoins(BigNumber(preflightResult.nativeFeesPaid)).decimalPlaces(8).toString();
      return { amount: feeCoins, currency: sourceCoin?.display_ticker || 'VRSC' };
    }

    // Default minimum fee for VRPC transactions
    if (channelType === VRPC) {
      return { amount: '0.0001', currency: sourceCoin?.display_ticker || 'VRSC' };
    }

    return null;
  }, [preflightResult, sourceCoin, channelType]);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!preflightResult) return;

    setSending(true);

    try {
      let result;

      if (isSimpleSend) {
        result = await send(
          sourceCoin,
          activeAccount,
          recipientAddress,
          BigNumber(amount),
          channel,
          preflightResult.params || {}
        );
      } else {
        result = await sendConvertOrCrossChain(
          sourceCoin,
          activeAccount,
          channel,
          preflightResult
        );
      }

      if (result.err) {
        throw new Error(result.result);
      }

      // Expire relevant data
      dispatch(expireCoinData(sourceCoin.id, API_GET_BALANCES));
      dispatch(expireCoinData(sourceCoin.id, API_GET_TRANSACTIONS));
      dispatch(expireCoinData(sourceCoin.id, API_GET_FIATPRICE));

      // Store result and navigate to success screen
      setTxResult(result.result);
      navigation.navigate('SendWizardSuccess');
    } catch (e) {
      console.error('Send error:', e);
      Alert.alert('Error', e.message || 'Transaction failed');
    }

    setSending(false);
  }, [
    preflightResult,
    isSimpleSend,
    sourceCoin,
    activeAccount,
    recipientAddress,
    amount,
    channel,
    dispatch,
    navigation,
    setTxResult,
  ]);

  // Truncate address
  const truncateAddress = (addr) => {
    if (!addr || addr.length <= 16) return addr;
    return `${addr.substring(0, 5)}...${addr.substring(addr.length - 5)}`;
  };

  if (!sourceCoin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#666' }}>No transaction data.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primaryColor} />
        <Text style={{ marginTop: 16, color: '#666' }}>Preparing transaction...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, { paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#E53935', textAlign: 'center' }}>
          Error
        </Text>
        <Text style={{ marginTop: 12, color: '#666', textAlign: 'center' }}>
          {error}
        </Text>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 24 }}
        >
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.mainTitle}>Confirm</Text>
          <Text style={styles.subtitle}>Review your transaction</Text>

          {/* Warnings */}
          {warnings.length > 0 && (
            <View style={styles.warningsContainer}>
              {warnings.map((w, i) => (
                <View key={i} style={styles.warningItem}>
                  <Text style={styles.warningText}>⚠️ {w.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Amount Section - Compact display */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>You're sending</Text>
            <View style={styles.amountRow}>
              {sourceCoin && RenderSquareCoinLogo(sourceCoin.id, { marginRight: 10 }, 32, 32)}
              <View>
                <Text style={styles.amountValue}>{amount}</Text>
                <Text style={styles.amountTicker}>{sourceCoin.display_ticker}</Text>
              </View>
            </View>

            {/* Conversion arrow and receive amount */}
            {isConversion && (
              <View style={styles.conversionSection}>
                <MaterialCommunityIcons name="arrow-down" size={20} color="#CCC" style={{ marginVertical: 8 }} />
                <Text style={styles.amountLabel}>You'll receive approximately</Text>
                <View style={styles.amountRow}>
                  {targetInfo.coinId && RenderSquareCoinLogo(targetInfo.coinId, { marginRight: 10 }, 32, 32)}
                  {!targetInfo.coinId && (
                    <View style={styles.placeholderLogo}>
                      <Text style={styles.placeholderText}>{(targetInfo.ticker || '?').substring(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.amountValue}>
                      ~{displayEstimate?.estimatedcurrencyout
                        ? BigNumber(displayEstimate.estimatedcurrencyout).decimalPlaces(8).toString()
                        : '?'}
                    </Text>
                    <Text style={styles.amountTicker}>{targetInfo.ticker}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Details Card */}
          <View style={styles.detailsCard}>
            {/* Recipient */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {recipientAddress.endsWith('@') ? recipientAddress : truncateAddress(recipientAddress)}
              </Text>
            </View>

            {/* Destination network (cross-chain) */}
            {(exportTo || isCrossChain) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Destination network</Text>
                <Text style={styles.detailValue}>
                  {getNetworkDisplayName(exportTo, exportToFqn || getCurrencyInfo(exportTo).name)}
                </Text>
              </View>
            )}

            {/* Route via */}
            {via && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Route via</Text>
                <Text style={styles.detailValue}>
                  {getCurrencyInfo(via).name}
                </Text>
              </View>
            )}

            {/* Estimated time until arrival */}
            {estimatedTime && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estimated time</Text>
                <Text style={styles.detailValue}>
                  {estimatedTime}
                </Text>
              </View>
            )}

            {/* Network fee */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network fee</Text>
              <Text style={styles.detailValue}>
                {feeInfo ? `${feeInfo.amount} ${feeInfo.currency}` : '~0.0001 VRSC'}
              </Text>
            </View>

            {/* From */}
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>From</Text>
              <View style={styles.fromValue}>
                <Text style={[styles.detailValue, { maxWidth: '100%' }]}>
                  {truncateAddress(sourceSubWallet?.name) || 'My wallet'}
                </Text>
              </View>
            </View>
          </View>

          {/* Balance info */}
          <Text style={styles.balanceNote}>
            Balance after: {BigNumber(sourceBalance || 0).minus(BigNumber(amount || 0)).decimalPlaces(4).toString()} {sourceCoin.display_ticker}
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.buttonContainer}>
        <GradientButton
          onPress={handleSend}
          disabled={sending || !preflightResult}
        >
          {sending ? 'Sending...' : 'Confirm & send'}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 24,
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
  },
  warningsContainer: {
    marginBottom: 16,
  },
  warningItem: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
  },
  // Amount section - compact display
  amountSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  amountTicker: {
    fontSize: 13,
    color: '#666',
    marginTop: 1,
  },
  conversionSection: {
    alignItems: 'center',
    marginTop: 4,
  },
  placeholderLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
  },
  // Details card
  detailsCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailRowLast: {
    borderBottomWidth: 0,
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
  fromValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  balanceNote: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 28,
    backgroundColor: 'white',
  },
});

export default SendWizardConfirm;
