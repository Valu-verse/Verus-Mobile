/*
  SendWizardSelectTarget
  - Step 2: Select target currency (convertto) or same currency for simple send
  - Shows conversion paths available from source currency
  - Redesigned with visual hierarchy: Send options at top, Popular conversions, then All
  - Created 2024-12-09
  - Updated 2024-12-10: Via options now filtered by exportTo destination
    Each via route is only valid for its specific exportTo (on-chain vs cross-chain)
    Fixed issue where invalid via routes were shown for cross-chain exports
  - Updated 2024-12-17: Fixed popular currency matching by using getCurrencyDisplayTicker
    to properly set the ticker field. Previously, ticker was set to displayName causing
    currencies like Ethereum (name: "Ethereum", ticker: "ETH") to not match "ETH" in popular list
  - Updated 2024-12-17: Group duplicate assets (e.g. DAI/Dai, MKR/Maker) by canonical key
    and show network picker when multiple network options exist. Use plain icons (no badge)
    for grouped asset rows. Uses SendExportToSheet with isGroupedAsset=true for network picker.
  - Updated 2024-12-18: Fixed handleNetworkSelect to use isOnChain flag and systemId
    instead of checking isCrossChain again. When user selects from grouped sheet, they've
    already made their network choice - on-chain stays local, cross-chain exports to systemId.
  - Updated 2024-12-23: Fixed ETH destination (bounceback) paths properly:
    - Keep ETH contract address for display (icons, names, grouping)
    - Store Verus currency ID separately as verusConvertTo for transactions
    - Store ETH display info (ethDisplayName, ethDisplayTicker) for network picker
    - Pass isBounceback flag and ethDisplayInfo through context for Amount screen display
  - Updated 2026-01-06: Hide "Same network" option in export sheet when a target has no
    on-chain conversion path. Prevents invalid on-chain estimates for cross-chain-only assets.
  - Updated 2026-01-06: Persist display labels and preflight-friendly names (FQNs) for the
    selected target/network so later steps never fall back to i-addresses and VRPC preflight
    matches the legacy send modal input format.
  - Updated 2026-01-08: Hide the automatic Verus badge on bridged assets when an
    "export to Ethereum" option is available for that row.
  - Updated 2026-01-08: Show a small sub-label under the "Send" row name that displays
    the source asset's fullyqualifiedname (Verus/PBaaS) or regular ticker (ETH/ERC20).
  - Updated 2026-01-15: Show dual Ethereum + Verus badges for targets that can be
    received on both Ethereum and Verus/PBaaS networks.
  - Updated 2026-01-15: Increased right spacing for option icons to accommodate
    dual badges without crowding text.
  - Updated 2026-01-15: Added extra icon-to-text spacing to prevent double badge
    overlap with labels.
  - Updated 2026-01-15: Styled search input to match Unlock password field,
    added right-side search icon, and search now matches fullyqualifiedname.
  - Updated 2026-01-15: Added a sticky-style header divider when the list scrolls,
    matching the Wallet screen behavior.
  - Updated 2026-01-15: Added a header close X to exit the send flow.
  - Updated 2026-01-15: Precompute VRSC bridge fee for Ethereum exports and
    pass it to the export sheet for display and gating.
  - Updated 2026-01-21: Fixed ERC20 → Verus mapping sends (e.g., USDC → vUSDC.vETH).
    When an export option has a mappingDestination, extract the fullyqualifiedname
    and pass it as mapTo so the ERC20 bridge preflight can resolve the mapped currency.
  - Updated 2026-01-22: Fixed grey placeholder icons by using currency ID fallback
    for icon rendering. Coins without explicit CoinDirectory entries now show
    algorithmically generated mosaic icons instead of grey letter placeholders.
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect, useRef } from 'react';
import { View, ScrollView, TextInput as RNTextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { RenderSquareCoinLogo, RenderPlainCoinLogo } from '../../utils/CoinData/Graphics';
import Colors from '../../globals/colors';
import { useSendWizard } from './SendWizardContext';
import { getConversionPaths } from '../../utils/api/routers/getConversionPaths';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import SendExportToSheet from './components/SendExportToSheet';
import { VRPC, ETH, ERC20 } from '../../utils/constants/intervalConstants';
import { calculateCurrencyTransferFee } from '../../utils/api/channels/vrpc/callCreators';
import { getAddressBalances } from '../../utils/api/routers/getAddressBalance';
import { satsToCoins } from '../../utils/math';
import BigNumber from 'bignumber.js';
import { 
  getCurrencyDisplayName, 
  getCurrencyDisplayTicker,
  getCanonicalAssetKey,
  getCanonicalAssetDisplayInfo,
} from './sendWizardDisplayInfo';

// Popular currency tickers to highlight (case insensitive matching)
const POPULAR_CURRENCIES = ['VRSC', 'USDC', 'ETH', 'TBTC', 'DAI'];

// vETH system ID (used to represent Ethereum export destination in conversion paths)
const VETH_SYSTEM_ID = 'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X';
const headerDividerThreshold = 1;

const getDualBadgeIcons = (item) => {
  if (!item || item.isGrouped) return null;
  const exportOptions = Array.isArray(item.exportOptions) ? item.exportOptions : [];
  const hasEthereumExport = exportOptions.some((o) => o?.exportTo === VETH_SYSTEM_ID);
  if (!hasEthereumExport) return null;

  const hasNonEthereumReceive =
    item.hasOnChainPath ||
    exportOptions.some((o) => o?.exportTo && o.exportTo !== VETH_SYSTEM_ID);

  return hasNonEthereumReceive ? ['ETH', 'VRSC'] : null;
};

const SendWizardSelectTarget = () => {
  const navigation = useNavigation();
  const { state, setTarget, setStep } = useSendWizard();
  const { sourceCoin, channel } = state;
  const activeAccount = useObjectSelector((s) => s.authentication.activeAccount);

  const [loading, setLoading] = useState(true);
  const [conversionPaths, setConversionPaths] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [pendingTarget, setPendingTarget] = useState(null);
  const [sendExportSheetVisible, setSendExportSheetVisible] = useState(false);
  // New state for grouped asset network selection
  const [networkSheetVisible, setNetworkSheetVisible] = useState(false);
  const [pendingGroupedAsset, setPendingGroupedAsset] = useState(null);
  const [showHeaderDivider, setShowHeaderDivider] = useState(false);
  const showHeaderDividerRef = useRef(false);
  const [bridgeFeeInfo, setBridgeFeeInfo] = useState({
    loading: false,
    feeCoins: null,
    feeSats: null,
    balanceCoins: null,
    systemId: null,
    sourceAddress: null,
    currencyTicker: 'VRSC',
    error: null,
  });

  const handleClose = useCallback(() => {
    const parent = navigation.getParent?.();
    if (parent && typeof parent.goBack === 'function') {
      parent.goBack();
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const renderCloseButton = useCallback(() => (
    <TouchableOpacity
      onPress={handleClose}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.headerCloseButton}
    >
      <MaterialCommunityIcons name="close" size={22} color={Colors.verusDarkGray} />
    </TouchableOpacity>
  ), [handleClose]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: renderCloseButton,
      headerBackTitle: 'Back',
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: 'white',
        elevation: 0,
        shadowOpacity: 0,
      },
    });
  }, [navigation, renderCloseButton]);

  const getPrimaryEthAddress = useCallback(() => {
    if (!activeAccount?.keys) return null;
    for (const coinId of Object.keys(activeAccount.keys)) {
      const coinKeys = activeAccount.keys[coinId];
      const ethAddresses = coinKeys?.[ETH]?.addresses || coinKeys?.[ERC20]?.addresses || [];
      if (ethAddresses.length > 0) return ethAddresses[0];
    }
    return null;
  }, [activeAccount]);

  useEffect(() => {
    let cancelled = false;

    const resetBridgeFee = () => {
      setBridgeFeeInfo({
        loading: false,
        feeCoins: null,
        feeSats: null,
        balanceCoins: null,
        systemId: null,
        sourceAddress: null,
        currencyTicker: 'VRSC',
        error: null,
      });
    };

    const fetchBridgeFee = async () => {
      if (!sourceCoin || !channel) {
        resetBridgeFee();
        return;
      }

      const channelType = channel.split('.')[0];
      if (channelType !== VRPC || sourceCoin.proto !== 'vrsc') {
        resetBridgeFee();
        return;
      }

      const parts = channel.split('.');
      const sourceAddress = parts[1];
      const systemId = parts[2] || sourceCoin.system_id || sourceCoin.id;

      if (!sourceAddress || !systemId) {
        resetBridgeFee();
        return;
      }

      const ethAddress = getPrimaryEthAddress();
      if (!ethAddress) {
        setBridgeFeeInfo({
          loading: false,
          feeCoins: null,
          feeSats: null,
          balanceCoins: null,
          systemId,
          sourceAddress,
          currencyTicker: 'VRSC',
          error: 'No Ethereum address available',
        });
        return;
      }

      setBridgeFeeInfo((prev) => ({
        ...prev,
        loading: true,
        error: null,
        systemId,
        sourceAddress,
        currencyTicker: 'VRSC',
      }));

      try {
        const [feeSats, balances] = await Promise.all([
          calculateCurrencyTransferFee(
            systemId,
            sourceCoin.currency_id || sourceCoin.id,
            VETH_SYSTEM_ID,
            null,
            systemId,
            null,
            sourceAddress,
            ethAddress,
            false,
          ),
          getAddressBalances(sourceCoin, channel, { address: sourceAddress }),
        ]);

        const feeCoins = satsToCoins(BigNumber(feeSats)).toString();
        const balanceCoins =
          balances && balances[systemId] != null ? String(balances[systemId]) : '0';

        if (cancelled) return;
        setBridgeFeeInfo({
          loading: false,
          feeCoins,
          feeSats: String(feeSats),
          balanceCoins,
          systemId,
          sourceAddress,
          currencyTicker: 'VRSC',
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setBridgeFeeInfo((prev) => ({
          ...prev,
          loading: false,
          feeCoins: null,
          feeSats: null,
          balanceCoins: prev.balanceCoins ?? null,
          systemId,
          sourceAddress,
          error: e?.message || 'Failed to estimate bridge fee',
        }));
      }
    };

    fetchBridgeFee();

    return () => {
      cancelled = true;
    };
  }, [sourceCoin, channel, getPrimaryEthAddress]);

  // Fetch conversion paths when source changes
  useEffect(() => {
    const fetchPaths = async () => {
      if (!sourceCoin || !channel) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const channelType = channel.split('.')[0];

        if (channelType === VRPC || channelType === ETH || channelType === ERC20) {
          const paths = await getConversionPaths(
            sourceCoin,
            channel,
            { src: sourceCoin.currency_id || sourceCoin.id }
          );
          setConversionPaths(paths || {});
        } else {
          setConversionPaths({});
        }
      } catch (e) {
        console.warn('Error fetching conversion paths:', e);
        setConversionPaths({});
      }

      setLoading(false);
    };

    fetchPaths();
  }, [sourceCoin, channel]);

  // Build structured options with send, popular, and other sections
  const { sendOption, popularOptions, otherOptions } = useMemo(() => {
    const destinationMap = new Map();
    const sourceCurrencyId = sourceCoin?.currency_id || sourceCoin?.id;
    const sameCurrencyExportOptions = [];

    // Process all conversion paths
    for (const [destId, pathList] of Object.entries(conversionPaths)) {
      if (!Array.isArray(pathList) || pathList.length === 0) continue;

      for (const path of pathList) {
        const dest = path.destination;
        if (!dest) continue;
        if (path.prelaunch) continue;

        // For ETH destination (bounceback) paths:
        // - Use ETH address for DISPLAY (icons, names, grouping)
        // - Use Verus currency ID for TRANSACTIONS (convertto parameter)
        const isEthDest = path.ethdest === true;
        
        // destCurrencyId is for DISPLAY - use ETH address for bounceback paths
        const destCurrencyId = dest.currencyid || dest.address || destId;
        
        // verusConvertTo is for TRANSACTIONS - use Verus currency ID for bounceback paths
        const verusConvertTo = isEthDest && dest.mapto
          ? (dest.mapto.currencyid || dest.mapto.fullyqualifiedname)
          : destCurrencyId;
        
        // Store ETH display info for network picker display
        const ethDisplayName = isEthDest ? (dest.name || dest.symbol || null) : null;
        const ethDisplayTicker = isEthDest ? (dest.symbol || dest.name || null) : null;
        
        const isSameCurrency = destCurrencyId === sourceCurrencyId;

        // Collect same-currency export options
        if (isSameCurrency && path.exportto) {
          const exportId = path.exportto.currencyid || path.exportto;
          const exportName = path.exportto.fullyqualifiedname || path.exportto.name || exportId;
          if (!sameCurrencyExportOptions.find((e) => e.exportTo === exportId)) {
            sameCurrencyExportOptions.push({
              exportTo: exportId,
              exportToName: exportName,
              gateway: path.gateway,
              via: null,
              price: path.price,
            });
          }
          continue;
        }

        // Handle mapping paths (off-chain to ETH representation)
        if (path.mapping && path.exportto) {
          const exportId = path.exportto.currencyid || path.exportto;
          const exportName = path.exportto.fullyqualifiedname || path.exportto.name || exportId;
          if (!sameCurrencyExportOptions.find((e) => e.exportTo === exportId)) {
            sameCurrencyExportOptions.push({
              exportTo: exportId,
              exportToName: exportName,
              gateway: path.gateway,
              via: null,
              price: path.price,
              mappingDestination: dest,
            });
          }
          continue;
        }

        if (isSameCurrency) continue;

        // Build conversion options
        if (!destinationMap.has(destCurrencyId)) {
          destinationMap.set(destCurrencyId, {
            dest,
            destId: destCurrencyId,
            paths: [],
            hasOnChainPath: false, // true if any valid path exists without exportto
            viaOptions: [],
            exportOptions: [],
            gateway: path.gateway || false,
            // ETH destination (bounceback) specific fields
            isEthDest: isEthDest,
            verusConvertTo: verusConvertTo,
            ethDisplayName: ethDisplayName,
            ethDisplayTicker: ethDisplayTicker,
          });
        }

        const entry = destinationMap.get(destCurrencyId);
        entry.paths.push(path);
        if (!path.exportto) {
          entry.hasOnChainPath = true;
        }

        // Store via options WITH their associated exportTo
        // Each via is only valid for its specific exportTo (or null for on-chain)
        const pathExportTo = path.exportto ? (path.exportto.currencyid || path.exportto) : null;
        
        if (path.via) {
          const viaId = path.via.currencyid || path.via;
          const viaName = path.via.fullyqualifiedname || path.via.name || viaId;
          // Store unique via + exportTo combinations
          const viaKey = `${viaId}:${pathExportTo || 'onchain'}`;
          if (!entry.viaOptions.find((v) => v.key === viaKey)) {
            entry.viaOptions.push({ 
              id: viaId, 
              name: viaName, 
              price: path.price,
              exportTo: pathExportTo, // Associate this via with its valid exportTo
              key: viaKey,
            });
          }
        } else {
          // Direct conversion (no via) - also associate with exportTo
          const directKey = `direct:${pathExportTo || 'onchain'}`;
          if (!entry.viaOptions.find((v) => v.key === directKey)) {
            entry.viaOptions.push({ 
              id: 'direct', 
              name: 'Direct', 
              price: path.price, 
              isDirect: true,
              exportTo: pathExportTo,
              key: directKey,
            });
          }
        }

        if (path.exportto) {
          const exportId = path.exportto.currencyid || path.exportto;
          const exportName = path.exportto.fullyqualifiedname || path.exportto.name || exportId;
          if (!entry.exportOptions.find((e) => e.exportTo === exportId)) {
            entry.exportOptions.push({
              exportTo: exportId,
              exportToName: exportName,
              gateway: path.gateway,
              via: path.via ? (path.via.currencyid || path.via) : null,
              price: path.price,
            });
          }
        }
      }
    }

    // Build send option
    let sendOpt = null;
    if (sourceCoin) {
      sendOpt = {
        id: sourceCurrencyId,
        name: sourceCoin.display_name,
        ticker: sourceCoin.display_ticker,
        coinId: sourceCoin.id,
        isConversion: false,
        isCrossChain: sameCurrencyExportOptions.length > 0,
        exportOptions: sameCurrencyExportOptions,
        viaOptions: [],
      };
    }

    // Build conversion options list and group by canonical asset key
    const conversionOptions = [];
    const groupedAssetMap = new Map(); // canonical key -> array of network options
    
    for (const [destCurrencyId, entry] of destinationMap) {
      const dest = entry.dest;
      let coinId = null;
      try {
        const foundCoin = CoinDirectory.findCoinObj(destCurrencyId);
        if (foundCoin) coinId = foundCoin.id;
      } catch (e) {}

      const fallbackName = dest.fullyqualifiedname || dest.name || dest.symbol || destCurrencyId;
      const displayName = getCurrencyDisplayName(destCurrencyId, fallbackName);
      const displayTicker = getCurrencyDisplayTicker(destCurrencyId, dest.symbol || fallbackName);
      
      // Get canonical key for grouping
      const canonicalKey = getCanonicalAssetKey(destCurrencyId, displayTicker, displayName);

      const optionData = {
        id: destCurrencyId,
        name: displayName,
        ticker: displayTicker,
        fullyqualifiedname: dest.fullyqualifiedname || dest.name || dest.symbol || destCurrencyId,
        coinId: coinId,
        isConversion: true,
        isCrossChain: entry.exportOptions.length > 0,
          hasOnChainPath: entry.hasOnChainPath,
        viaOptions: entry.viaOptions,
        exportOptions: entry.exportOptions,
        gateway: entry.gateway,
        canonicalKey: canonicalKey,
        // For ETH destination (bounceback) paths:
        // - verusConvertTo: Verus currency ID for transactions
        // - ethDisplayName/ethDisplayTicker: ETH token info for network picker display
        isEthDest: entry.isEthDest,
        verusConvertTo: entry.verusConvertTo,
        ethDisplayName: entry.ethDisplayName,
        ethDisplayTicker: entry.ethDisplayTicker,
      };
      
      // Add to grouped map
      if (!groupedAssetMap.has(canonicalKey)) {
        groupedAssetMap.set(canonicalKey, []);
      }
      groupedAssetMap.get(canonicalKey).push(optionData);
    }
    
    // Build final conversion options - either grouped or single
    for (const [canonicalKey, networkOptions] of groupedAssetMap) {
      if (networkOptions.length === 1) {
        // Single option - add directly without grouping
        conversionOptions.push(networkOptions[0]);
      } else {
        // Multiple network options - create a grouped entry
        const displayInfo = getCanonicalAssetDisplayInfo(canonicalKey);
        
        // Try to find a coinId from any of the options (prefer non-ERC20)
        let groupCoinId = null;
        for (const opt of networkOptions) {
          if (opt.coinId && !opt.coinId.startsWith('0x')) {
            groupCoinId = opt.coinId;
            break;
          }
        }
        // Fallback to first available coinId
        if (!groupCoinId) {
          groupCoinId = networkOptions[0].coinId;
        }
        
        // Merge all via options and export options from all network options
        const allViaOptions = [];
        const allExportOptions = [];
        for (const opt of networkOptions) {
          allViaOptions.push(...(opt.viaOptions || []));
          allExportOptions.push(...(opt.exportOptions || []));
        }
        
        conversionOptions.push({
          id: canonicalKey, // Use canonical key as ID for grouped items
          name: displayInfo.name,
          ticker: displayInfo.ticker,
          coinId: groupCoinId,
          isConversion: true,
          isCrossChain: allExportOptions.length > 0,
          viaOptions: allViaOptions,
          exportOptions: allExportOptions,
          gateway: networkOptions.some(o => o.gateway),
          isGrouped: true, // Flag to indicate this is a grouped item
          networkOptions: networkOptions, // Keep individual options for network picker
          canonicalKey: canonicalKey,
        });
      }
    }

    // Split into popular and other
    const popular = [];
    const other = [];

    for (const opt of conversionOptions) {
      const canonicalKey = opt.canonicalKey || '';
      const nameUpper = (opt.name || '').toUpperCase();
      const tickerUpper = (opt.ticker || '').toUpperCase();
      
      const isPopular = POPULAR_CURRENCIES.some((p) => {
        // Check canonical key, name, and ticker for match
        return canonicalKey === p ||
               nameUpper === p || 
               tickerUpper === p || 
               nameUpper.startsWith(p + '.') || 
               tickerUpper.startsWith(p + '.') ||
               nameUpper.endsWith('.' + p) ||
               tickerUpper.endsWith('.' + p);
      });
      
      if (isPopular) {
        popular.push(opt);
      } else {
        other.push(opt);
      }
    }

    // Sort popular by the order in POPULAR_CURRENCIES
    popular.sort((a, b) => {
      const findPopularIndex = (opt) => {
        const canonicalKey = opt.canonicalKey || '';
        const nameUpper = (opt.name || '').toUpperCase();
        const tickerUpper = (opt.ticker || '').toUpperCase();
        
        return POPULAR_CURRENCIES.findIndex((p) => 
          canonicalKey === p ||
          nameUpper === p || 
          tickerUpper === p || 
          nameUpper.startsWith(p + '.') || 
          tickerUpper.startsWith(p + '.') ||
          nameUpper.endsWith('.' + p) ||
          tickerUpper.endsWith('.' + p)
        );
      };
      
      const aIdx = findPopularIndex(a);
      const bIdx = findPopularIndex(b);
      return aIdx - bIdx;
    });

    // Sort other alphabetically
    other.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return { sendOption: sendOpt, popularOptions: popular, otherOptions: other };
  }, [sourceCoin, conversionPaths]);

  // Filter all options by search
  const { filteredSend, filteredPopular, filteredOther } = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return { filteredSend: sendOption, filteredPopular: popularOptions, filteredOther: otherOptions };
    }

    const matchesQuery = (opt) => {
      const name = (opt?.name || '').toLowerCase();
      const ticker = (opt?.ticker || '').toLowerCase();
      const id = (opt?.id || '').toLowerCase();
      const fullyqualifiedname = (opt?.fullyqualifiedname || '').toLowerCase();
      return (
        name.includes(query) ||
        ticker.includes(query) ||
        id.includes(query) ||
        fullyqualifiedname.includes(query)
      );
    };

    return {
      filteredSend: sendOption && matchesQuery(sendOption) ? sendOption : null,
      filteredPopular: popularOptions.filter(matchesQuery),
      filteredOther: otherOptions.filter(matchesQuery),
    };
  }, [searchTerm, sendOption, popularOptions, otherOptions]);

  const handleSelectTarget = useCallback(
    (target, exportTo = null) => {
      // Filter via options to only include those valid for the selected exportTo
      // - If exportTo is null (on-chain), only show via options with exportTo: null
      // - If exportTo is set (cross-chain), only show via options with matching exportTo
      const allViaOptions = target.viaOptions || [];
      const filteredViaOptions = allViaOptions.filter((viaOpt) => {
        if (exportTo === null) {
          // On-chain: only via options without exportTo
          return viaOpt.exportTo === null || viaOpt.exportTo === undefined;
        } else {
          // Cross-chain: only via options matching the selected exportTo
          return viaOpt.exportTo === exportTo;
        }
      });

      // Remove the internal 'key' and 'exportTo' fields from via options before passing to context
      const cleanViaOptions = filteredViaOptions.map(({ id, name, price, isDirect }) => ({
        id,
        name,
        price,
        ...(isDirect ? { isDirect } : {}),
      }));

      // For ETH destination (bounceback) paths:
      // - Use verusConvertTo for the target currency (the Verus currency ID)
      // - target.id is the ETH address for display, verusConvertTo is for transactions
      const targetCurrency = target.isEthDest && target.verusConvertTo
        ? target.verusConvertTo
        : target.id;

      // mapTo is only used for non-bounceback mapping paths (mapping: true flag)
      // Also check if the selected export option has a mappingDestination (for ERC20 → Verus sends)
      let mapTo = target.mapping ? target.id : null;
      if (!mapTo && exportTo != null) {
        const selectedExportOption = (target?.exportOptions || []).find((o) => o.exportTo === exportTo);
        if (selectedExportOption?.mappingDestination) {
          // Use the fullyqualifiedname of the mapping destination for mapto
          // This is what the ERC20 bridge preflight expects
          mapTo = selectedExportOption.mappingDestination.fullyqualifiedname 
            || selectedExportOption.mappingDestination.name 
            || selectedExportOption.mappingDestination.currencyid;
        }
      }

      // For bounceback paths, pass the ETH display info for proper display in Amount screen
      const isBounceback = target.isEthDest === true;
      const ethDisplayInfo = isBounceback && (target.ethDisplayTicker || target.ethDisplayName)
        ? { 
            ticker: target.ethDisplayTicker, 
            name: target.ethDisplayName,
            contractAddress: target.id, // The ETH contract address for icon display
          }
        : null;

      // Display labels: what we show in Amount/Confirm screens (should never be raw i-addresses)
      const targetDisplayName = target?.name || null;
      const targetDisplayTicker = target?.ticker || target?.name || null;

      // Preflight-friendly names: pass FQNs (like the legacy modal) to VRPC preflight when possible.
      // For bounceback paths, convertto must remain the Verus currency ID, so skip convertToFqn.
      const convertToFqn =
        !isBounceback && target?.isConversion
          ? (target?.fullyqualifiedname || target?.name || null)
          : null;
      const exportToFqn =
        exportTo != null
          ? (target?.exportOptions || []).find((o) => o.exportTo === exportTo)?.exportToName || null
          : null;

      setTarget(
        targetCurrency,
        exportTo,
        target.isConversion,
        exportTo != null,
        mapTo,
        cleanViaOptions,
        isBounceback,
        ethDisplayInfo,
        targetDisplayName,
        targetDisplayTicker,
        convertToFqn,
        exportToFqn
      );
      setStep(3);
      navigation.navigate('SendWizardAmount');
    },
    [setTarget, setStep, navigation],
  );

  const handleConversionPress = useCallback(
    (target) => {
      // For grouped assets with multiple network options, show network picker first
      if (target.isGrouped && target.networkOptions && target.networkOptions.length > 1) {
        setPendingGroupedAsset(target);
        setNetworkSheetVisible(true);
        return;
      }
      
      // For conversions with cross-chain, show export sheet
      if (target.isCrossChain && target.exportOptions && target.exportOptions.length > 0) {
        setPendingTarget(target);
        setExportSheetVisible(true);
      } else {
        handleSelectTarget(target, null);
      }
    },
    [handleSelectTarget],
  );
  
  // Handle selection from network picker for grouped assets
  // When user selects a network from the grouped sheet, they've already made their choice
  // - isOnChain: stay on source network, no export needed
  // - not isOnChain: cross-chain, export to the selected network's systemId
  const handleNetworkSelect = useCallback(
    (networkOption) => {
      setNetworkSheetVisible(false);
      setPendingGroupedAsset(null);
      
      if (networkOption.isOnChain) {
        // On-chain option: no export needed, stay on source network
        handleSelectTarget(networkOption, null);
      } else if (networkOption.systemId) {
        // Cross-chain option: export to the selected network's system
        handleSelectTarget(networkOption, networkOption.systemId);
      } else {
        // Fallback: shouldn't happen, but handle gracefully
        console.warn('handleNetworkSelect: networkOption missing systemId for cross-chain', networkOption);
        handleSelectTarget(networkOption, null);
      }
    },
    [handleSelectTarget],
  );

  // Render a single currency option row
  // For grouped items (isGrouped=true), use plain icon without badge
  const renderOptionRow = (item, showChevron = false) => (
    <TouchableOpacity
      key={item.id}
      style={styles.optionRow}
      onPress={() => handleConversionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.optionLeft}>
        {/* Use coinId if available, otherwise fall back to item.id for mosaic generation */}
        {item.isGrouped 
          ? RenderPlainCoinLogo(item.coinId || item.id, {}, 40, 40)
          : RenderSquareCoinLogo(item.coinId || item.id, {}, 40, 40, {
              badgeIcons: getDualBadgeIcons(item),
              disableBadge: Array.isArray(item.exportOptions)
                ? item.exportOptions.some((o) => o?.exportTo === VETH_SYSTEM_ID)
                : false,
            })}
      </View>
      <View style={styles.optionCenter}>
        <Text style={styles.optionName} numberOfLines={1}>{item.name}</Text>
      </View>
      {/* Show chevron for grouped items or cross-chain items */}
      {(showChevron || item.isGrouped) && (
        <MaterialCommunityIcons name="chevron-right" size={22} color="#999" />
      )}
    </TouchableOpacity>
  );

  // Render send section - primary action is same network, secondary is cross-chain
  const renderSendSection = () => {
    if (!filteredSend) return null;

    const hasExportOptions = filteredSend.exportOptions && filteredSend.exportOptions.length > 0;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Send</Text>
        
        {/* Primary: Same network send */}
        <TouchableOpacity
          style={styles.sendPrimaryOption}
          onPress={() => handleSelectTarget(filteredSend, null)}
          activeOpacity={0.7}
        >
          <View style={styles.optionLeft}>
            {/* Use coinId if available, otherwise fall back to id for mosaic generation */}
            {RenderSquareCoinLogo(filteredSend.coinId || filteredSend.id, {}, 40, 40, {
              disableBadge: Array.isArray(filteredSend.exportOptions)
                ? filteredSend.exportOptions.some((o) => o?.exportTo === VETH_SYSTEM_ID)
                : false,
            })}
          </View>
          <View style={styles.optionCenter}>
            <Text style={styles.optionName}>{filteredSend.name}</Text>
            <Text style={styles.optionSubtext} numberOfLines={1}>
              {filteredSend.ticker || filteredSend.name || ''}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Secondary: Cross-chain indicator */}
        {hasExportOptions && (
          <TouchableOpacity
            style={styles.crossChainIndicator}
            onPress={() => setSendExportSheetVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={18} color="#666" />
            <Text style={styles.crossChainText}>Cross-chain send available</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!sourceCoin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#666' }}>No source currency selected.</Text>
      </View>
    );
  }

  const hasResults = filteredSend || filteredPopular.length > 0 || filteredOther.length > 0;
  
  const handleResultsScroll = useCallback((event) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    const next = y > headerDividerThreshold;
    if (next !== showHeaderDividerRef.current) {
      showHeaderDividerRef.current = next;
      setShowHeaderDivider(next);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, showHeaderDivider && styles.headerScrolled]}>
        <Text style={styles.mainTitle}>What should the recipient receive?</Text>
        <View
          style={[
            styles.searchInputContainer,
            searchFocused && styles.searchInputFocused,
          ]}
        >
          <RNTextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search currencies"
            placeholderTextColor="#999"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.searchInput}
          />
          <View style={styles.searchIcon}>
            <MaterialCommunityIcons name="magnify" size={20} color="#999" />
          </View>
        </View>
      </View>

      {loading ? (
        <View style={[styles.centered, { paddingTop: 48 }]}>
          <ActivityIndicator size="large" color={Colors.primaryColor} />
          <Text style={{ marginTop: 16, color: '#666' }}>Loading options...</Text>
        </View>
      ) : !hasResults ? (
        <View style={[styles.centered, { paddingTop: 48 }]}>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
            {searchTerm.trim().length > 0
              ? 'No currencies match your search.'
              : 'No options available.'}
          </Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleResultsScroll}
          scrollEventThrottle={16}
        >
          {renderSendSection()}

          {filteredPopular.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Popular conversions</Text>
              {filteredPopular.map((item) => renderOptionRow(item, item.isCrossChain))}
            </View>
          )}

          {filteredOther.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>
                {filteredPopular.length > 0 ? 'More conversions' : 'Conversions'}
              </Text>
              {filteredOther.map((item) => renderOptionRow(item, item.isCrossChain))}
            </View>
          )}
        </ScrollView>
      )}

      {exportSheetVisible && pendingTarget && (
        <SendExportToSheet
          visible={exportSheetVisible}
          targetCurrency={pendingTarget}
          sourceCoin={sourceCoin}
          hideSameNetwork={pendingTarget.hasOnChainPath === false}
          bridgeFeeInfo={bridgeFeeInfo}
          onClose={() => {
            setExportSheetVisible(false);
            setPendingTarget(null);
          }}
          onSelect={(exportTo) => {
            setExportSheetVisible(false);
            const target = pendingTarget;
            setPendingTarget(null);
            handleSelectTarget(target, exportTo);
          }}
          onSelectSameChain={() => {
            setExportSheetVisible(false);
            const target = pendingTarget;
            setPendingTarget(null);
            handleSelectTarget(target, null);
          }}
        />
      )}

      {/* Send cross-chain sheet - for same currency off-chain sends */}
      {/* hideSameNetwork=true because same network send is already shown as the primary option */}
      {sendExportSheetVisible && filteredSend && (
        <SendExportToSheet
          visible={sendExportSheetVisible}
          targetCurrency={filteredSend}
          sourceCoin={sourceCoin}
          hideSameNetwork={true}
          bridgeFeeInfo={bridgeFeeInfo}
          onClose={() => setSendExportSheetVisible(false)}
          onSelect={(exportTo) => {
            setSendExportSheetVisible(false);
            handleSelectTarget(filteredSend, exportTo);
          }}
          onSelectSameChain={() => {
            setSendExportSheetVisible(false);
            handleSelectTarget(filteredSend, null);
          }}
        />
      )}
      
      {/* Network picker for grouped assets (same asset on multiple networks) */}
      {networkSheetVisible && pendingGroupedAsset && (
        <SendExportToSheet
          visible={networkSheetVisible}
          targetCurrency={pendingGroupedAsset}
          sourceCoin={sourceCoin}
          isGroupedAsset={true}
          bridgeFeeInfo={bridgeFeeInfo}
          onClose={() => {
            setNetworkSheetVisible(false);
            setPendingGroupedAsset(null);
          }}
          onSelectNetworkOption={handleNetworkSelect}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'white',
  },
  headerScrolled: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E4EA',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 4,
    marginTop: 8,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginTop: 16,
    height: 52,
  },
  searchInputFocused: {
    backgroundColor: '#FFF',
    borderColor: Colors.primaryColor,
    shadowColor: Colors.primaryColor,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  searchIcon: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
  },
  headerCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 6,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sendPrimaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F8F8F8',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  crossChainIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  crossChainText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  optionLeft: {
    marginRight: 28,
  },
  optionCenter: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
    marginTop: 2,
  },
  placeholderLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
  },
});

export default SendWizardSelectTarget;
