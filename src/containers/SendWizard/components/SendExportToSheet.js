/*
  SendExportToSheet
  - Bottom sheet for selecting destination chain (exportto) for cross-chain sends
  - Shows available chains/networks where the target currency can be received
  - Styled to match SendWizardSelectSource design
  - Created 2024-12-09
  - Updated 2024-12-10: Dynamically looks up ERC20 ticker via mapped_to property
*/

import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Portal, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import { RenderSquareCoinLogo } from '../../../utils/CoinData/Graphics';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { 
  getNetworkDisplayName, 
  getNetworkIcon,
  getCurrencyDisplayName 
} from '../sendWizardDisplayInfo';

// vETH system ID - needs special handling for source vs export context
const VETH_SYSTEM_ID = 'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X';

/**
 * Get the display name for the SOURCE network (where currency currently lives)
 */
const getSourceNetworkDisplayName = (systemId, fallback) => {
  if (systemId === VETH_SYSTEM_ID) {
    return 'Verus';
  }
  return getNetworkDisplayName(systemId, fallback);
};

/**
 * Get the icon for the SOURCE network
 */
const getSourceNetworkIcon = (systemId) => {
  if (systemId === VETH_SYSTEM_ID) {
    return 'VRSC';
  }
  return getNetworkIcon(systemId);
};

/**
 * Get the ERC20 ticker for a Verus currency that maps to Ethereum
 * Uses the mapped_to property from CoinDirectory
 */
const getErc20Ticker = (currencyId) => {
  if (!currencyId) return null;
  
  try {
    // Look up the Verus currency
    const coinObj = CoinDirectory.findCoinObj(currencyId);
    if (!coinObj || !coinObj.mapped_to) return null;
    
    // Get the mapped ERC20 coin
    const mappedCoin = CoinDirectory.getBasicCoinObj(coinObj.mapped_to);
    if (mappedCoin && mappedCoin.display_ticker) {
      return mappedCoin.display_ticker;
    }
  } catch (e) {
    // Currency not found in CoinDirectory
  }
  
  return null;
};

/**
 * Get the ticker that will be received for an export option
 * For Ethereum exports, looks up the ERC20 ticker dynamically
 */
const getReceivedTicker = (opt, targetCurrency, sourceCoin) => {
  // For mapping destinations (same-currency → ERC20), use the ERC20 symbol
  if (opt.mappingDestination) {
    const dest = opt.mappingDestination;
    return dest.symbol || dest.name || getCurrencyDisplayName(dest.currencyid || dest.address, null);
  }
  
  // For Ethereum exports, try to get the ERC20 ticker via mapped_to
  if (opt.exportTo === VETH_SYSTEM_ID && targetCurrency?.id) {
    const erc20Ticker = getErc20Ticker(targetCurrency.id);
    if (erc20Ticker) {
      return erc20Ticker;
    }
  }
  
  // For conversions, use the target currency's fullyqualifiedname
  if (targetCurrency?.isConversion && targetCurrency?.fullyqualifiedname) {
    return targetCurrency.fullyqualifiedname;
  }
  
  // Fallback to source ticker for same-currency sends
  return sourceCoin?.display_ticker || targetCurrency?.ticker || 'tokens';
};

const SendExportToSheet = ({
  visible,
  targetCurrency,
  sourceCoin,
  onClose,
  onSelect,
  onSelectSameChain,
  hideSameNetwork = false,
}) => {
  const insets = useSafeAreaInsets();
  const paddingBottom = 16 + insets.bottom;

  if (!visible || !targetCurrency) return null;

  const exportOptions = targetCurrency.exportOptions || [];

  // Get source system info for "Same network" option
  const sourceSystemId = sourceCoin?.system_id || sourceCoin?.id;
  const sourceNetworkName = getSourceNetworkDisplayName(sourceSystemId, sourceCoin?.display_name || 'current network');
  const sourceNetworkIcon = getSourceNetworkIcon(sourceSystemId);
  
  // For same network option, use target's fullyqualifiedname if conversion, else source ticker
  const sameNetworkTicker = targetCurrency?.isConversion 
    ? (targetCurrency.fullyqualifiedname || targetCurrency.ticker || targetCurrency.name)
    : (sourceCoin?.display_ticker || '');

  // Get user-friendly target currency name
  const targetDisplayName = getCurrencyDisplayName(
    targetCurrency.id,
    targetCurrency.name || targetCurrency.ticker || 'this currency'
  );

  const hasCrossChainOptions = exportOptions.length > 0;

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        flexHeight={0.01}
        contentContainerStyle={styles.modalContent}
      >
        <View>
          {/* Header */}
          <View style={styles.header}>
            <Button onPress={onClose} textColor={Colors.primaryColor}>
              {'Close'}
            </Button>
            <Text style={styles.headerTitle}>Select network</Text>
            <View style={{ width: 64 }} />
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionText}>
              Choose where the recipient should receive {targetDisplayName}.
            </Text>
          </View>

          {/* Options */}
          <ScrollView style={styles.scrollView}>
            <View style={styles.optionsContainer}>
              {/* On-chain option - Primary/Recommended */}
              {!hideSameNetwork && (
                <>
                  <TouchableOpacity
                    style={styles.primaryOptionCard}
                    onPress={onSelectSameChain}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionIconContainer}>
                      {RenderSquareCoinLogo(sourceNetworkIcon, {}, 40, 40)}
                    </View>
                    <View style={styles.optionContent}>
                      <View style={styles.primaryTitleRow}>
                        <Text style={styles.optionTitle}>{sourceNetworkName}</Text>
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedText}>ON-CHAIN</Text>
                        </View>
                      </View>
                      <Text style={styles.optionDescription}>
                        Receive as {sameNetworkTicker}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.primaryColor} />
                  </TouchableOpacity>
                </>
              )}

              {/* Cross-chain section */}
              {hasCrossChainOptions && (
                <>
                  <View style={styles.sectionDivider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.sectionLabel}>Cross-chain</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {exportOptions.map((opt, index) => {
                    const chainId = opt.exportTo;
                    const chainName = getNetworkDisplayName(chainId, opt.exportToName);
                    const chainIcon = getNetworkIcon(chainId);
                    const receivedTicker = getReceivedTicker(opt, targetCurrency, sourceCoin);

                    return (
                      <TouchableOpacity
                        key={chainId || index}
                        style={styles.secondaryOptionCard}
                        onPress={() => onSelect(chainId)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.optionIconContainer}>
                          {RenderSquareCoinLogo(chainIcon, {}, 40, 40)}
                        </View>
                        <View style={styles.optionContent}>
                          <Text style={styles.secondaryOptionTitle}>{chainName}</Text>
                          <Text style={styles.secondaryOptionDescription}>
                            Receive as {receivedTicker}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={22} color="#CCC" />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </SemiModal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flex: 0,
    width: '100%',
    alignSelf: 'flex-end',
    maxHeight: '70%',
  },
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
  descriptionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  scrollView: {
    maxHeight: 400,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // Primary option (on-chain) - highlighted
  primaryOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.primaryColor,
  },
  primaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  recommendedBadge: {
    backgroundColor: Colors.primaryColor,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  // Secondary options (cross-chain) - muted
  secondaryOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  secondaryOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginBottom: 2,
  },
  secondaryOptionDescription: {
    fontSize: 13,
    color: '#999',
  },
  // Section divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
  },
});

export default SendExportToSheet;
