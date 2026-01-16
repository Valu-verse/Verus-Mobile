/*
  SendViaSheet
  - Bottom sheet for selecting conversion routing (via)
  - Shows available via options with estimated outputs
  - Options sorted by best estimate first with "BEST" badge
  - Card-based design matching SendSourceSubwalletSheet
  - Created 2024-12-09
  - Updated 2024-12-10: Redesigned with card layout, improved styling
  - Updated 2026-01-09: Show route option outputs truncated to 8 decimals (trim trailing zeros),
    display the target FQN under the output, and hide per-option rate lines.
  - 2026-01-12: Standardized header close affordance to shared SemiModal header (top-right X).
*/

import React, { useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { RenderSquareCoinLogo } from '../../../utils/CoinData/Graphics';
import { getCurrencyDisplayName } from '../sendWizardDisplayInfo';
import BigNumber from 'bignumber.js';

const trimTrailingZeros = (valueStr) => {
  if (typeof valueStr !== 'string') return valueStr;
  // Remove trailing zeros in decimals, then remove a trailing '.' if present.
  return valueStr.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '').replace(/\.$/, '');
};

const formatTruncatedRate = (rateBnOrValue, decimals = 8) => {
  try {
    const bn = BigNumber(rateBnOrValue);
    if (!bn.isFinite() || bn.isNaN()) return null;

    const truncated = bn.decimalPlaces(decimals, BigNumber.ROUND_DOWN);
    const fixed = truncated.toFixed(decimals); // avoid scientific notation
    const trimmed = trimTrailingZeros(fixed);

    // Normalise "-0" edge cases to "0"
    return trimmed === '-0' ? '0' : trimmed;
  } catch (e) {
    return null;
  }
};

const SendViaSheet = ({
  visible,
  viaOptions,
  viaEstimates = {},
  currentVia,
  targetTicker,
  targetFqn,
  onClose,
  onSelect,
}) => {
  const insets = useSafeAreaInsets();
  const paddingBottom = 16 + insets.bottom;

  // Filter out 'direct' option and sort by best estimate first
  const sortedOptions = useMemo(() => {
    const options = (viaOptions || []).filter(opt => opt.id !== 'direct' && !opt.isDirect);
    
    return [...options].sort((a, b) => {
      const estimateA = viaEstimates[a.id]?.output ? parseFloat(viaEstimates[a.id].output) : 0;
      const estimateB = viaEstimates[b.id]?.output ? parseFloat(viaEstimates[b.id].output) : 0;
      return estimateB - estimateA; // Descending (best first)
    });
  }, [viaOptions, viaEstimates]);

  // Get currency display info with better name resolution
  const getCurrencyInfo = (currencyId, fallbackName) => {
    if (!currencyId) return { name: fallbackName || 'Unknown', ticker: fallbackName || '?', coinId: null };
    
    // First try CoinDirectory
    try {
      const coin = CoinDirectory.findCoinObj(currencyId);
      if (coin) return { name: coin.display_name, ticker: coin.display_ticker, coinId: coin.id };
    } catch (e) {}
    
    // Try sendWizardDisplayInfo
    const displayName = getCurrencyDisplayName(currencyId, null);
    if (displayName && displayName !== currencyId) {
      return { name: displayName, ticker: displayName, coinId: null };
    }
    
    // Use fallback name if provided
    if (fallbackName && fallbackName !== currencyId) {
      return { name: fallbackName, ticker: fallbackName, coinId: null };
    }
    
    // Last resort: truncate the ID
    const truncated = currencyId.length > 12 ? `${currencyId.substring(0, 8)}...` : currencyId;
    return { name: truncated, ticker: truncated, coinId: null };
  };

  if (!visible) return null;

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        title="Conversion route"
        flexHeight={0.01}
        contentContainerStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flex: 0,
          width: '100%',
          alignSelf: 'flex-end',
          paddingBottom,
          maxHeight: '70%',
        }}
      >
        <View>
          {/* Description */}
          <View style={styles.description}>
            <Text style={styles.descriptionText}>
              Select which currency to route the conversion through. Different routes may offer different rates.
            </Text>
          </View>

          {/* Via options */}
          <ScrollView style={{ maxHeight: 400 }}>
            <View style={styles.listContainer}>
              {sortedOptions.map((opt, index) => {
                const viaId = typeof opt === 'string' ? opt : opt.id;
                const viaName = typeof opt === 'string' ? opt : opt.name;
                const info = getCurrencyInfo(viaId, viaName);
                const isSelected = currentVia === viaId;
                const estimateData = viaEstimates[viaId];
                const hasEstimate = estimateData?.output;
                const isBest = index === 0 && hasEstimate;
                const outputDisplay = hasEstimate ? formatTruncatedRate(estimateData.output, 8) : null;

                return (
                  <TouchableOpacity
                    key={viaId || index}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                      isBest && styles.optionCardBest,
                    ]}
                    onPress={() => onSelect(viaId)}
                    activeOpacity={0.7}
                  >
                    {/* Left: Icon and name */}
                    <View style={styles.optionLeft}>
                      {info.coinId ? (
                        <View style={styles.iconContainer}>
                          {RenderSquareCoinLogo(info.coinId, {}, 36, 36)}
                        </View>
                      ) : (
                        <View style={styles.placeholderIcon}>
                          <Text style={styles.placeholderText}>
                            {(info.ticker || '??').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.optionInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.optionName}>{info.name}</Text>
                          {isBest && (
                            <View style={styles.bestBadge}>
                              <Text style={styles.bestBadgeText}>BEST</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Right: Estimate and checkmark */}
                    <View style={styles.optionRight}>
                      {hasEstimate ? (
                        <View style={styles.estimateContainer}>
                          <Text style={[
                            styles.estimateAmount,
                            isBest && styles.estimateAmountBest,
                          ]}>
                            {outputDisplay ?? BigNumber(estimateData.output).toString()}
                          </Text>
                          <Text style={styles.estimateTicker}>{targetFqn || targetTicker || 'output'}</Text>
                        </View>
                      ) : estimateData?.error ? (
                        <Text style={styles.errorText}>Error</Text>
                      ) : null}
                      
                      {isSelected ? (
                        <MaterialCommunityIcons 
                          name="check-circle" 
                          size={22} 
                          color={Colors.verusGreenColor} 
                          style={styles.checkIcon}
                        />
                      ) : (
                        <MaterialCommunityIcons 
                          name="chevron-right" 
                          size={20} 
                          color="#CCC" 
                          style={styles.chevronIcon}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {sortedOptions.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No conversion routes available</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </SemiModal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  description: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Option card
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: '#E8F5E8',
    borderColor: Colors.verusGreenColor,
  },
  optionCardBest: {
    backgroundColor: '#F0FFF0',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeholderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  optionInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  bestBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#D4EDDA',
    borderRadius: 4,
  },
  bestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.verusGreenColor,
    letterSpacing: 0.5,
  },
  rateText: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estimateContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  estimateAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  estimateAmountBest: {
    color: Colors.verusGreenColor,
  },
  estimateTicker: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#E53935',
    marginRight: 8,
  },
  checkIcon: {
    marginLeft: 4,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

export default SendViaSheet;
