/*
  SendWizardSelectTarget
  - Step 2: Select target currency (convertto) or same currency for simple send
  - Shows conversion paths available from source currency
  - Redesigned with visual hierarchy: Send options at top, Popular conversions, then All
  - Created 2024-12-09
  - Updated 2024-12-10: Via options now filtered by exportTo destination
    Each via route is only valid for its specific exportTo (on-chain vs cross-chain)
    Fixed issue where invalid via routes were shown for cross-chain exports
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect } from 'react';
import { View, ScrollView, TextInput as RNTextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import Colors from '../../globals/colors';
import { useSendWizard } from './SendWizardContext';
import { getConversionPaths } from '../../utils/api/routers/getConversionPaths';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import SendExportToSheet from './components/SendExportToSheet';
import { VRPC, ETH, ERC20 } from '../../utils/constants/intervalConstants';
import { getCurrencyDisplayName } from './sendWizardDisplayInfo';

// Popular currency tickers to highlight (case insensitive matching)
const POPULAR_CURRENCIES = ['VRSC', 'USDC', 'ETH', 'TBTC', 'DAI', 'MKR'];

const SendWizardSelectTarget = () => {
  const navigation = useNavigation();
  const { state, setTarget, setStep } = useSendWizard();
  const { sourceCoin, channel } = state;

  const [loading, setLoading] = useState(true);
  const [conversionPaths, setConversionPaths] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [pendingTarget, setPendingTarget] = useState(null);
  const [sendExportSheetVisible, setSendExportSheetVisible] = useState(false);

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

        const destCurrencyId = dest.currencyid || dest.address || destId;
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
            viaOptions: [],
            exportOptions: [],
            gateway: path.gateway || false,
          });
        }

        const entry = destinationMap.get(destCurrencyId);
        entry.paths.push(path);

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

    // Build conversion options list
    const conversionOptions = [];
    for (const [destCurrencyId, entry] of destinationMap) {
      const dest = entry.dest;
      let coinId = null;
      try {
        const foundCoin = CoinDirectory.findCoinObj(destCurrencyId);
        if (foundCoin) coinId = foundCoin.id;
      } catch (e) {}

      const fallbackName = dest.fullyqualifiedname || dest.name || dest.symbol || destCurrencyId;
      const displayName = getCurrencyDisplayName(destCurrencyId, fallbackName);

      conversionOptions.push({
        id: destCurrencyId,
        name: displayName,
        ticker: displayName,
        fullyqualifiedname: dest.fullyqualifiedname || dest.name || dest.symbol || destCurrencyId,
        coinId: coinId,
        isConversion: true,
        isCrossChain: entry.exportOptions.length > 0,
        viaOptions: entry.viaOptions,
        exportOptions: entry.exportOptions,
        gateway: entry.gateway,
      });
    }

    // Split into popular and other
    const popular = [];
    const other = [];

    for (const opt of conversionOptions) {
      const nameUpper = (opt.name || '').toUpperCase();
      const tickerUpper = (opt.ticker || '').toUpperCase();
      const isPopular = POPULAR_CURRENCIES.some(
        (p) => nameUpper === p || tickerUpper === p || nameUpper.startsWith(p + '.') || tickerUpper.startsWith(p + '.')
      );
      if (isPopular) {
        popular.push(opt);
      } else {
        other.push(opt);
      }
    }

    // Sort popular by the order in POPULAR_CURRENCIES
    popular.sort((a, b) => {
      const aIdx = POPULAR_CURRENCIES.findIndex((p) => 
        (a.name || '').toUpperCase().startsWith(p) || (a.ticker || '').toUpperCase().startsWith(p)
      );
      const bIdx = POPULAR_CURRENCIES.findIndex((p) => 
        (b.name || '').toUpperCase().startsWith(p) || (b.ticker || '').toUpperCase().startsWith(p)
      );
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
      return name.includes(query) || ticker.includes(query) || id.includes(query);
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

      setTarget(
        target.id,
        exportTo,
        target.isConversion,
        exportTo != null,
        target.mapping ? target.id : null,
        cleanViaOptions
      );
      setStep(3);
      navigation.navigate('SendWizardAmount');
    },
    [setTarget, setStep, navigation],
  );

  const handleConversionPress = useCallback(
    (target) => {
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

  // Render a single currency option row
  const renderOptionRow = (item, showChevron = false) => (
    <TouchableOpacity
      key={item.id}
      style={styles.optionRow}
      onPress={() => handleConversionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.optionLeft}>
        {item.coinId ? (
          RenderSquareCoinLogo(item.coinId, {}, 40, 40)
        ) : (
          <View style={styles.placeholderLogo}>
            <Text style={styles.placeholderText}>
              {(item.ticker || '?').substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.optionCenter}>
        <Text style={styles.optionName} numberOfLines={1}>{item.name}</Text>
      </View>
      {showChevron && (
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
            {filteredSend.coinId ? (
              RenderSquareCoinLogo(filteredSend.coinId, {}, 40, 40)
            ) : (
              <View style={styles.placeholderLogo}>
                <Text style={styles.placeholderText}>
                  {(filteredSend.ticker || '?').substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.optionCenter}>
            <Text style={styles.optionName}>{filteredSend.name}</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.mainTitle}>What should the recipient receive?</Text>
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
          style={[
            styles.searchInput,
            searchFocused && styles.searchInputFocused,
          ]}
        />
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
  searchInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#F5F5F5',
    marginTop: 16,
  },
  searchInputFocused: {
    borderColor: Colors.primaryColor,
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
    marginRight: 14,
  },
  optionCenter: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
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
