/*
  SendExportToSheet
  - Bottom sheet for selecting destination chain/network for sends
  - Two modes:
    1. Export mode: Shows cross-chain export options for a single currency
    2. Grouped mode: Shows different network versions of the same asset (e.g., DAI on Ethereum vs DAI.vETH)
  - Created 2024-12-09
  - Updated 2024-12-10: Dynamically looks up ERC20 ticker via mapped_to property
  - Updated 2024-12-17: Consolidated with SendAssetNetworkSheet - now handles both
    export options and grouped asset network selection via isGroupedAsset prop
  - Updated 2024-12-18: Fixed grouped mode to:
    - Properly look up ERC20 tokens by currency_id (0x address)
    - Show SAME NETWORK badge for option matching source network
    - Sort options with source network first
    - Use getGroupedOptionTicker() to look up display_ticker from CoinDirectory
      for consistent naming (e.g., "VRSC [ERC20]" instead of "Verus on Ethereum")
  - Updated 2024-12-23: UI improvements:
    - Changed card styling to equal visual weight with subtle left-edge accent
    - Changed badge text from "ON-CHAIN" to "SAME NETWORK"
    - Removed "Cross-chain" section divider
    - Normalized text and chevron colors across all options
  - Updated 2024-12-23: Fixed ETH destination display:
    - Use ethDisplayTicker from option when available (for bounceback paths)
    - Shows "DAI" instead of "DAI.vETH" for Ethereum network option
  - Updated 2026-01-06: Hide "Same network" option when a target has no on-chain route.
    Adds explicit copy when only one cross-chain network is available.
  - Updated 2026-01-08: Show fullyqualifiedname (FQNs) for Verus/PBaaS receive assets
    in "Receive as ..." copy, while keeping ERC20-friendly names on Ethereum.
  - 2026-01-12: Standardized header close affordance to shared SemiModal header (top-right X).
  - 2026-01-15: Use source subwallet network for "same network" and infer grouped
    network system IDs from FQNs/tickers to display PBaaS networks like vARRR correctly.
  - 2026-01-15: Show VRSC bridge fee (and fiat) on Ethereum options and
    disable selection when the source address lacks the fee.
  - 2026-01-15: Tightened bridge fee formatting to 4 decimals and
    adjusted disabled styling to dim row content while keeping fee/warning clear.
*/

import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { formatCurrency } from 'react-native-format-currency';
import BigNumber from 'bignumber.js';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import { RenderSquareCoinLogo } from '../../../utils/CoinData/Graphics';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { useSendWizard } from '../SendWizardContext';
import { coinsList } from '../../../utils/CoinData/CoinsList';
import { GENERAL, WYRE_SERVICE } from '../../../utils/constants/intervalConstants';
import { USD } from '../../../utils/constants/currencies';
import { 
  getNetworkDisplayName, 
  getNetworkIcon,
  getCurrencyDisplayName 
} from '../sendWizardDisplayInfo';

// vETH system ID - needs special handling for source vs export context
const VETH_SYSTEM_ID = 'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X';
const VRSC_SYSTEM_ID = 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV';

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
 * Get the display label for a network/system, preferring PBaaS tickers for systems.
 */
const getNetworkLabelFromSystemId = (systemId, fallback = null) => {
  if (!systemId) return fallback || 'Unknown';
  if (systemId === VETH_SYSTEM_ID) return 'Verus';
  if (systemId === VRSC_SYSTEM_ID || systemId === 'VRSC') return 'Verus';
  if (systemId === '.eth') return 'Ethereum';

  try {
    const coinObj = CoinDirectory.findCoinObj(systemId);
    if (coinObj) {
      if (coinObj.system_id === coinObj.id && coinObj.display_ticker) {
        return coinObj.display_ticker;
      }
      return coinObj.display_name || coinObj.display_ticker;
    }
  } catch (e) {
    // Not found in CoinDirectory
  }

  return getNetworkDisplayName(systemId, fallback);
};

const findSystemCoinByTicker = (ticker) => {
  if (!ticker) return null;
  try {
    const allCoins = Object.values(CoinDirectory.coins || {});
    const tickerLc = ticker.toLowerCase();
    return allCoins.find((coin) => {
      const displayTicker = (coin.display_ticker || '').toLowerCase();
      const displayName = (coin.display_name || '').toLowerCase();
      return displayTicker === tickerLc || displayName === tickerLc;
    }) || null;
  } catch (e) {
    return null;
  }
};

const getFqnNetworkToken = (value) => {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.replace(/@$/, '');
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    const suffix = parts[parts.length - 1];
    return suffix || null;
  }
  const onMatch = cleaned.match(/\s+on\s+(.+)$/i);
  if (onMatch && onMatch[1]) {
    return onMatch[1].trim();
  }
  return null;
};

const resolveGroupedOptionSystemId = (option) => {
  if (!option) return null;
  const explicitSystemId = option.systemId || option.systemid || option.system_id;
  if (explicitSystemId) return explicitSystemId;

  try {
    const coinObj = CoinDirectory.findCoinObj(option.id);
    if (coinObj?.system_id) return coinObj.system_id;
  } catch (e) {
    // Not found by id
  }

  if (option.id && option.id.startsWith('0x')) {
    try {
      const allCoins = Object.values(CoinDirectory.coins || {});
      const matchingCoin = allCoins.find((coin) =>
        coin.currency_id && coin.currency_id.toLowerCase() === option.id.toLowerCase()
      );
      if (matchingCoin?.system_id) return matchingCoin.system_id;
    } catch (e) {
      // Search failed
    }
    return '.eth';
  }

  const inferredToken = getFqnNetworkToken(option.fullyqualifiedname || option.ticker || option.name);
  if (inferredToken) {
    const tokenLc = inferredToken.toLowerCase();
    if (tokenLc === 'eth' || tokenLc === 'ethereum') return '.eth';
    const systemCoin = findSystemCoinByTicker(inferredToken);
    if (systemCoin?.id) return systemCoin.id;
  }

  return null;
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
 * Determine whether a currency lives on Ethereum (native ETH / ERC20).
 * We treat system_id === '.eth' (or obvious 0x contract addresses) as Ethereum.
 */
const isEthereumCurrency = (currencyId) => {
  if (!currencyId) return false;
  if (currencyId === '.eth') return true;
  if (typeof currencyId === 'string' && currencyId.startsWith('0x')) return true;

  try {
    const coinObj = CoinDirectory.findCoinObj(currencyId);
    return coinObj?.system_id === '.eth' || coinObj?.proto === 'eth' || coinObj?.proto === 'erc20';
  } catch (e) {
    return false;
  }
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
  
  // For conversions, show the fullyqualifiedname on Verus/PBaaS (non-Ethereum) receives
  if (targetCurrency?.isConversion) {
    return (
      targetCurrency?.fullyqualifiedname ||
      targetCurrency?.ticker ||
      targetCurrency?.name ||
      'tokens'
    );
  }
  
  // Fallback to source ticker for same-currency sends
  return sourceCoin?.display_ticker || targetCurrency?.ticker || 'tokens';
};

/**
 * Get the display ticker for a grouped asset network option
 * Looks up the actual display_ticker from CoinDirectory for consistency
 * Handles both Verus i-addresses and Ethereum contract addresses (0x)
 * For ETH destination (bounceback) paths, uses the ethDisplayTicker from the option
 */
const getGroupedOptionTicker = (option, isEthereumNetwork = false) => {
  if (!option?.id) {
    return option?.fullyqualifiedname || option?.ticker || option?.name || 'tokens';
  }

  // For Verus/PBaaS options, prefer the fullyqualifiedname directly (per UX requirements).
  if (!isEthereumNetwork && option?.fullyqualifiedname) {
    return option.fullyqualifiedname;
  }
  
  // For Ethereum network options with ETH display info, use that
  // This shows "DAI" instead of "DAI.vETH" for the Ethereum option
  if (isEthereumNetwork && option.ethDisplayTicker) {
    return option.ethDisplayTicker;
  }
  
  try {
    // First, try direct lookup by id
    const coinObj = CoinDirectory.findCoinObj(option.id);
    if (coinObj?.display_ticker) {
      return coinObj.display_ticker;
    }
  } catch (e) {
    // Not found by id
  }
  
  // If id is an Ethereum address (0x), search by currency_id
  if (option.id.startsWith('0x')) {
    try {
      const allCoins = Object.values(CoinDirectory.coins || {});
      const matchingCoin = allCoins.find(coin => 
        coin.currency_id && coin.currency_id.toLowerCase() === option.id.toLowerCase()
      );
      if (matchingCoin?.display_ticker) {
        return matchingCoin.display_ticker;
      }
    } catch (e) {
      // Search failed
    }
    
    // For 0x addresses, try using ethDisplayTicker if available
    if (option.ethDisplayTicker) {
      return option.ethDisplayTicker;
    }
  }
  
  // Fallback to fullyqualifiedname or ticker
  return option.fullyqualifiedname || option.ticker || option.name || 'tokens';
};

/**
 * Get network info for a grouped asset option (used in grouped mode)
 * Determines the network name and icon based on the currency's system_id
 * Handles both Verus i-addresses and Ethereum contract addresses
 */
const getNetworkInfoForGroupedOption = (option) => {
  let systemId = resolveGroupedOptionSystemId(option);
  let networkName = systemId ? getNetworkLabelFromSystemId(systemId, null) : null;
  let networkIcon = 'VRSC';

  if (systemId === '.eth') {
    networkIcon = 'ETH';
  } else if (systemId === VETH_SYSTEM_ID || systemId === VRSC_SYSTEM_ID || systemId === 'VRSC') {
    networkIcon = 'VRSC';
  } else if (systemId) {
    networkIcon = getNetworkIcon(systemId);
  }

  if (!networkName) {
    const inferredToken = getFqnNetworkToken(option?.fullyqualifiedname || option?.ticker || option?.name);
    if (inferredToken) {
      const tokenLc = inferredToken.toLowerCase();
      if (tokenLc === 'veth' || tokenLc === 'verus') {
        networkName = 'Verus';
        networkIcon = 'VRSC';
        systemId = systemId || VETH_SYSTEM_ID;
      } else if (tokenLc === 'eth' || tokenLc === 'ethereum') {
        networkName = 'Ethereum';
        networkIcon = 'ETH';
        systemId = systemId || '.eth';
      } else {
        networkName = inferredToken;
        const systemCoin = findSystemCoinByTicker(inferredToken);
        if (!systemId && systemCoin?.id) {
          systemId = systemCoin.id;
          networkIcon = getNetworkIcon(systemCoin.id);
        }
      }
    }
  }

  return { networkName: networkName || 'Unknown', networkIcon, systemId };
};

const SendExportToSheet = ({
  visible,
  targetCurrency,
  sourceCoin,
  onClose,
  onSelect,
  onSelectSameChain,
  hideSameNetwork = false,
  // Grouped asset mode props
  isGroupedAsset = false,
  onSelectNetworkOption = null, // (networkOption, exportTo) => void
  bridgeFeeInfo = null,
}) => {
  const { state: wizardState } = useSendWizard();
  const sourceSubWallet = wizardState?.sourceSubWallet;
  const sourceChannel = wizardState?.channel;
  const displayCurrency = useSelector(
    (s) => s.settings.generalWalletSettings.displayCurrency || USD,
  );
  const rates = useSelector((s) => s.ledger.rates);
  const insets = useSafeAreaInsets();
  const paddingBottom = 16 + insets.bottom;

  // Determine source network for grouped mode (to highlight on-chain option)
  const sourceNetworkSystemId = useMemo(() => {
    if (sourceSubWallet?.network) return sourceSubWallet.network;
    if (typeof sourceChannel === 'string') {
      const parts = sourceChannel.split('.');
      if (parts.length >= 3 && parts[2]) return parts[2];
    }
    return sourceCoin?.system_id || sourceCoin?.id || null;
  }, [sourceSubWallet, sourceChannel, sourceCoin]);

  const sourceNetworkLabel = useMemo(() => (
    getNetworkLabelFromSystemId(
      sourceNetworkSystemId,
      sourceCoin?.display_name || null
    )
  ), [sourceNetworkSystemId, sourceCoin]);

  const bridgeFeeBn = useMemo(() => {
    if (bridgeFeeInfo?.feeCoins == null) return null;
    try {
      return BigNumber(bridgeFeeInfo.feeCoins);
    } catch (e) {
      return null;
    }
  }, [bridgeFeeInfo]);

  const bridgeFeeBalanceBn = useMemo(() => {
    if (bridgeFeeInfo?.balanceCoins == null) return null;
    try {
      return BigNumber(bridgeFeeInfo.balanceCoins);
    } catch (e) {
      return null;
    }
  }, [bridgeFeeInfo]);

  const bridgeFeeRate = useMemo(() => {
    const coinId = coinsList?.VRSC?.id;
    if (!coinId) return null;
    return rates?.[WYRE_SERVICE]?.[coinId]?.[displayCurrency] != null
      ? rates[WYRE_SERVICE][coinId][displayCurrency]
      : rates?.[GENERAL]?.[coinId]?.[displayCurrency] != null
        ? rates[GENERAL][coinId][displayCurrency]
        : null;
  }, [rates, displayCurrency]);

  const bridgeFeeFiatDisplay = useMemo(() => {
    if (!bridgeFeeBn || bridgeFeeRate == null) return null;
    const fiat = bridgeFeeBn.multipliedBy(bridgeFeeRate);
    if (!fiat.isFinite() || fiat.isNaN()) return null;
    const rounded = fiat.decimalPlaces(2, BigNumber.ROUND_HALF_UP);
    try {
      const [formatted] = formatCurrency({ amount: rounded.toFixed(2), code: displayCurrency });
      return formatted;
    } catch (e) {
      return null;
    }
  }, [bridgeFeeBn, bridgeFeeRate, displayCurrency]);

  const bridgeFeeLine = useMemo(() => {
    if (!bridgeFeeInfo) return null;
    if (bridgeFeeInfo.loading) return 'Bridge fee: calculating...';
    if (!bridgeFeeBn) return 'Bridge fee unavailable';
    const feeText = bridgeFeeBn.decimalPlaces(4, BigNumber.ROUND_HALF_UP).toFixed(4);
    const ticker = bridgeFeeInfo.currencyTicker || 'VRSC';
    const fiatSuffix = bridgeFeeFiatDisplay ? ` (${bridgeFeeFiatDisplay})` : '';
    return `Bridge fee: ${feeText} ${ticker}${fiatSuffix}`;
  }, [bridgeFeeInfo, bridgeFeeBn, bridgeFeeFiatDisplay]);

  const bridgeFeeInsufficient = useMemo(() => {
    if (!bridgeFeeBn || !bridgeFeeBalanceBn) return false;
    return bridgeFeeBalanceBn.isLessThan(bridgeFeeBn);
  }, [bridgeFeeBn, bridgeFeeBalanceBn]);

  // Build network options for grouped asset mode
  const groupedNetworkOptions = useMemo(() => {
    if (!isGroupedAsset || !targetCurrency?.networkOptions) return [];
    
    const options = targetCurrency.networkOptions.map((opt) => {
      const { networkName, networkIcon, systemId } = getNetworkInfoForGroupedOption(opt);
      // Mark if this option is on the same network as the source (on-chain)
      const isOnChain = systemId && sourceNetworkSystemId
        ? systemId === sourceNetworkSystemId
        : networkName === sourceNetworkLabel;
      return { ...opt, networkName, networkIcon, systemId, isOnChain };
    });
    
    // Sort: on-chain (source network) first, then others alphabetically
    return options.sort((a, b) => {
      // On-chain option comes first
      if (a.isOnChain && !b.isOnChain) return -1;
      if (b.isOnChain && !a.isOnChain) return 1;
      // Otherwise sort alphabetically
      return a.networkName.localeCompare(b.networkName);
    });
  }, [isGroupedAsset, targetCurrency, sourceNetworkSystemId, sourceNetworkLabel]);

  if (!visible || !targetCurrency) return null;

  const exportOptions = targetCurrency.exportOptions || [];

  // Get source system info for "Same network" option
  const sourceSystemId = sourceNetworkSystemId || sourceCoin?.system_id || sourceCoin?.id;
  const sourceNetworkName = sourceNetworkLabel || getSourceNetworkDisplayName(
    sourceSystemId,
    sourceCoin?.display_name || 'current network'
  );
  const sourceNetworkIcon = getSourceNetworkIcon(sourceSystemId);
  
  // For same network option:
  // - Verus/PBaaS: show fullyqualifiedname
  // - Ethereum/ERC20: show ERC20-friendly ticker/name
  const sourceIsEthereum = isEthereumCurrency(sourceSystemId) || isEthereumCurrency(sourceCoin?.id);
  const sameNetworkTicker = targetCurrency?.isConversion
    ? (sourceIsEthereum
        ? (targetCurrency?.ticker || targetCurrency?.name || targetCurrency?.fullyqualifiedname)
        : (targetCurrency?.fullyqualifiedname || targetCurrency?.ticker || targetCurrency?.name))
    : (sourceCoin?.display_ticker || '');

  // Get user-friendly target currency name
  const targetDisplayName = getCurrencyDisplayName(
    targetCurrency.id,
    targetCurrency.name || targetCurrency.ticker || 'this currency'
  );

  const hasCrossChainOptions = exportOptions.length > 0;
  
  // Description text (export mode can hide the same-network option when no on-chain route exists)
  const descriptionText = useMemo(() => {
    if (isGroupedAsset) {
      return `${targetDisplayName} is available on multiple networks. Choose where the recipient should receive it.`;
    }
    
    // Export mode: if same-network is hidden and there's only one option, be explicit
    if (hideSameNetwork && exportOptions.length === 1) {
      const onlyOpt = exportOptions[0];
      const chainId = onlyOpt.exportTo;
      const chainName =
        getNetworkDisplayName(chainId, onlyOpt.exportToName) ||
        onlyOpt.exportToName ||
        'selected';
      return `This asset is only available on the ${chainName} network.`;
    }
    
    return `Choose where the recipient should receive ${targetDisplayName}.`;
  }, [isGroupedAsset, hideSameNetwork, exportOptions, targetDisplayName]);

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        title="Select network"
        flexHeight={0.01}
        contentContainerStyle={styles.modalContent}
      >
        <View>
          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionText}>
              {descriptionText}
            </Text>
          </View>

          {/* Options */}
          <ScrollView style={styles.scrollView}>
            <View style={[styles.optionsContainer, { paddingBottom }]}>
              {/* GROUPED ASSET MODE: Show network options for different versions of same asset */}
              {isGroupedAsset && groupedNetworkOptions.length > 0 && (
                <>
                  {groupedNetworkOptions.map((opt) => {
                    // Use isOnChain to show left accent and badge
                    const isSameNetwork = opt.isOnChain;
                    // Check if this is an Ethereum network option
                    const isEthereumNetwork = opt.systemId === '.eth' || opt.networkName === 'Ethereum';
                    // Look up the proper display_ticker
                    // For Ethereum options with ETH destination, shows "DAI" not "DAI.vETH"
                    const receiveTicker = getGroupedOptionTicker(opt, isEthereumNetwork);
                    const showBridgeFee = Boolean(bridgeFeeInfo) && isEthereumNetwork;
                    const isDisabled = showBridgeFee && bridgeFeeInsufficient;
                    
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.optionCard,
                          isSameNetwork && styles.optionCardWithAccent,
                          isDisabled && styles.optionCardDisabled,
                        ]}
                        onPress={isDisabled ? undefined : () => onSelectNetworkOption?.(opt, null)}
                        activeOpacity={isDisabled ? 1 : 0.7}
                        disabled={isDisabled}
                      >
                        <View style={[styles.optionIconContainer, isDisabled && styles.optionIconDisabled]}>
                          {RenderSquareCoinLogo(opt.networkIcon, {}, 40, 40)}
                        </View>
                        <View style={styles.optionContent}>
                          <View style={styles.titleRow}>
                            <Text style={[styles.optionTitle, isDisabled && styles.optionTitleDisabled]}>
                              {opt.networkName}
                            </Text>
                            {isSameNetwork && (
                              <View style={styles.sameNetworkBadge}>
                                <Text style={styles.sameNetworkText}>SAME NETWORK</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.optionDescription, isDisabled && styles.optionDescriptionDisabled]}>
                            Receive as {receiveTicker}
                          </Text>
                          {showBridgeFee && bridgeFeeLine && (
                            <Text style={[styles.optionFeeText, isDisabled && styles.optionFeeTextDisabled]}>
                              {bridgeFeeLine}
                            </Text>
                          )}
                          {isDisabled && (
                            <Text style={styles.optionDisabledText}>
                              Insufficient VRSC for bridge fee
                            </Text>
                          )}
                        </View>
                        <MaterialCommunityIcons 
                          name="chevron-right" 
                          size={22} 
                          color={isDisabled ? '#C2C2C2' : '#888'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* EXPORT MODE: Same network option - with left accent */}
              {!isGroupedAsset && !hideSameNetwork && (
                <TouchableOpacity
                  style={[styles.optionCard, styles.optionCardWithAccent]}
                  onPress={onSelectSameChain}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIconContainer}>
                    {RenderSquareCoinLogo(sourceNetworkIcon, {}, 40, 40)}
                  </View>
                  <View style={styles.optionContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.optionTitle}>{sourceNetworkName}</Text>
                      <View style={styles.sameNetworkBadge}>
                        <Text style={styles.sameNetworkText}>SAME NETWORK</Text>
                      </View>
                    </View>
                    <Text style={styles.optionDescription}>
                      Receive as {sameNetworkTicker}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#888" />
                </TouchableOpacity>
              )}

              {/* EXPORT MODE: Cross-chain options */}
              {!isGroupedAsset && hasCrossChainOptions && (
                <>
                  {exportOptions.map((opt, index) => {
                    const chainId = opt.exportTo;
                    const chainName = getNetworkDisplayName(chainId, opt.exportToName);
                    const chainIcon = getNetworkIcon(chainId);
                    const receivedTicker = getReceivedTicker(opt, targetCurrency, sourceCoin);
                    const isEthereumOption = chainId === VETH_SYSTEM_ID;
                    const showBridgeFee = Boolean(bridgeFeeInfo) && isEthereumOption;
                    const isDisabled = showBridgeFee && bridgeFeeInsufficient;

                    return (
                      <TouchableOpacity
                        key={chainId || index}
                        style={[styles.optionCard, isDisabled && styles.optionCardDisabled]}
                        onPress={isDisabled ? undefined : () => onSelect(chainId)}
                        activeOpacity={isDisabled ? 1 : 0.7}
                        disabled={isDisabled}
                      >
                        <View style={[styles.optionIconContainer, isDisabled && styles.optionIconDisabled]}>
                          {RenderSquareCoinLogo(chainIcon, {}, 40, 40)}
                        </View>
                        <View style={styles.optionContent}>
                          <Text style={[styles.optionTitle, isDisabled && styles.optionTitleDisabled]}>
                            {chainName}
                          </Text>
                          <Text style={[styles.optionDescription, isDisabled && styles.optionDescriptionDisabled]}>
                            Receive as {receivedTicker}
                          </Text>
                          {showBridgeFee && bridgeFeeLine && (
                            <Text style={[styles.optionFeeText, isDisabled && styles.optionFeeTextDisabled]}>
                              {bridgeFeeLine}
                            </Text>
                          )}
                          {isDisabled && (
                            <Text style={styles.optionDisabledText}>
                              Insufficient VRSC for bridge fee
                            </Text>
                          )}
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={22}
                          color={isDisabled ? '#C2C2C2' : '#888'}
                        />
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
  // Unified option card - equal visual weight for all options
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  // Left accent for "same network" option
  optionCardWithAccent: {
    borderLeftColor: Colors.primaryColor,
  },
  optionCardDisabled: {
    backgroundColor: '#F7F7F7',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  // "SAME NETWORK" badge - subtle indicator
  sameNetworkBadge: {
    backgroundColor: Colors.primaryColor,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  sameNetworkText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconDisabled: {
    opacity: 0.45,
  },
  optionContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionTitleDisabled: {
    color: '#9A9A9A',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 1,
  },
  optionDescriptionDisabled: {
    color: '#B0B0B0',
  },
  optionFeeText: {
    fontSize: 12,
    color: '#444',
    marginTop: 4,
  },
  optionFeeTextDisabled: {
    color: '#444',
  },
  optionDisabledText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B71C1C',
    marginTop: 2,
  },
});

export default SendExportToSheet;
