/*
  SendWizardConfirm
  - Step 5: Overview and confirmation of transaction
  - Runs preflight to validate and get fee info
  - Shows summary including fees, conversion rates, warnings
  - Created 2024-12-09
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, Button, List, Divider } from 'react-native-paper';
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
import { getIdentity } from '../../utils/api/channels/verusid/callCreators';
import { getCurrencyDisplayName } from './sendWizardDisplayInfo';

const SendWizardConfirm = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { state, setPreflight, setLoading, reset } = useSendWizard();
  const {
    sourceCoin,
    sourceSubWallet,
    sourceBalance,
    targetCurrency,
    exportTo,
    isConversion,
    isCrossChain,
    mapTo,
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

  // Build destination from address
  const buildDestination = useCallback(async () => {
    const addr = recipientAddress.trim();

    // VerusID
    if (addr.endsWith('@')) {
      const systemId = sourceCoin.system_id || sourceCoin.id;
      const identityRes = await getIdentity(systemId, addr);

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
  }, [recipientAddress, sourceCoin]);

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
            output.convertto = targetCurrency;
          }

          if (isCrossChain && exportTo) {
            output.exportto = exportTo;
          }

          if (via) {
            output.via = via;
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

        if (result.result.estimate == null && isConversion) {
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

  // Get currency info for display - uses sendWizardDisplayInfo for friendly names
  const getCurrencyInfo = useCallback((currencyId, optionalViaOptions = null) => {
    if (!currencyId) return { name: 'Unknown', ticker: '?', coinId: null };
    
    // First try CoinDirectory
    try {
      const coin = CoinDirectory.findCoinObj(currencyId);
      if (coin) return { name: coin.display_name, ticker: coin.display_ticker, coinId: coin.id };
    } catch (e) {}
    
    // Check if this ID exists in viaOptions with a name
    const viaOpts = optionalViaOptions || viaOptions;
    if (viaOpts) {
      const viaOpt = viaOpts.find(v => v.id === currencyId);
      if (viaOpt?.name && viaOpt.name !== currencyId) {
        return { name: viaOpt.name, ticker: viaOpt.name, coinId: null };
      }
    }
    
    // Try sendWizardDisplayInfo for friendly name
    const displayName = getCurrencyDisplayName(currencyId, null);
    if (displayName && displayName !== currencyId) {
      return { name: displayName, ticker: displayName, coinId: null };
    }
    
    // Fallback: truncate the ID if it's long
    const name = currencyId.length > 16 ? `${currencyId.substring(0, 8)}...${currencyId.slice(-6)}` : currencyId;
    return { name, ticker: name, coinId: null };
  }, [viaOptions]);

  const targetInfo = useMemo(() => {
    return getCurrencyInfo(targetCurrency);
  }, [targetCurrency, getCurrencyInfo]);

  // Format amounts for display
  const formatAmount = useCallback((sats, decimals = 8) => {
    if (!sats) return '0';
    return satsToCoins(BigNumber(sats)).decimalPlaces(decimals).toString();
  }, []);

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

      // Navigate to success
      Alert.alert(
        'Transaction Sent',
        `Your transaction has been submitted successfully.${result.result.txid ? `\n\nTxID: ${result.result.txid.substring(0, 16)}...` : ''}`,
        [
          {
            text: 'Done',
            onPress: () => {
              reset();
              navigation.popToTop();
            },
          },
        ]
      );
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
    reset,
    navigation,
  ]);

  // Truncate address
  const truncateAddress = (addr) => {
    if (!addr || addr.length <= 20) return addr;
    return `${addr.substring(0, 10)}...${addr.substring(addr.length - 10)}`;
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

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            {/* Sending */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sending</Text>
              <View style={styles.summaryValue}>
                <Text style={styles.summaryAmount}>
                  {amount} {sourceCoin.display_ticker}
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Receiving (for conversions) */}
            {isConversion && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Estimated receive</Text>
                  <View style={styles.summaryValue}>
                    <Text style={styles.summaryAmount}>
                      ~{estimate?.estimatedcurrencyout
                        ? BigNumber(estimate.estimatedcurrencyout).decimalPlaces(8).toString()
                        : '?'} {targetInfo.ticker}
                    </Text>
                  </View>
                </View>
                <Divider style={styles.divider} />
              </>
            )}

            {/* To */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>To</Text>
              <Text style={styles.summaryAddressValue}>
                {truncateAddress(recipientAddress)}
              </Text>
            </View>

            <Divider style={styles.divider} />

            {/* Network/Chain */}
            {(exportTo || isCrossChain) && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Destination network</Text>
                  <Text style={styles.summaryTextValue}>
                    {getCurrencyInfo(exportTo).name}
                  </Text>
                </View>
                <Divider style={styles.divider} />
              </>
            )}

            {/* Via */}
            {via && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Route via</Text>
                  <Text style={styles.summaryTextValue}>
                    {getCurrencyInfo(via).name}
                  </Text>
                </View>
                <Divider style={styles.divider} />
              </>
            )}

            {/* Fee */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Network fee</Text>
              <Text style={styles.summaryTextValue}>
                {preflightResult?.fee
                  ? `~${preflightResult.fee} ${preflightResult.feeCurr || sourceCoin.display_ticker}`
                  : 'Included'}
              </Text>
            </View>
          </View>

          {/* From */}
          <View style={styles.fromSection}>
            <Text style={styles.sectionLabel}>From</Text>
            <View style={styles.fromCard}>
              {sourceCoin && RenderSquareCoinLogo(sourceCoin.id, { marginRight: 12 }, 32, 32)}
              <View style={{ flex: 1 }}>
                <Text style={styles.fromTitle}>{sourceSubWallet?.name || 'My wallet'}</Text>
                <Text style={styles.fromBalance}>
                  Balance: {BigNumber(sourceBalance || 0).decimalPlaces(4).toString()} {sourceCoin.display_ticker}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSend}
          loading={sending}
          disabled={sending || !preflightResult}
          style={styles.confirmButton}
          contentStyle={styles.confirmButtonContent}
          labelStyle={styles.confirmButtonLabel}
        >
          {sending ? 'Sending...' : 'Confirm & Send'}
        </Button>
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
    fontSize: 16,
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
  },
  summaryCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    alignItems: 'flex-end',
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
  },
  summaryTextValue: {
    fontSize: 14,
    fontWeight: '500',
    color: 'black',
  },
  summaryAddressValue: {
    fontSize: 13,
    fontWeight: '500',
    color: 'black',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  divider: {
    backgroundColor: '#E0E0E0',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fromSection: {
    marginBottom: 24,
  },
  fromCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
  },
  fromTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
  },
  fromBalance: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  confirmButton: {
    borderRadius: 12,
    backgroundColor: Colors.primaryColor,
  },
  confirmButtonContent: {
    height: 52,
  },
  confirmButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SendWizardConfirm;

