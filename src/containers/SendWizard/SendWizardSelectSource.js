/*
  SendWizardSelectSource
  - Step 1: Select source asset and subwallet for sending
  - UI modeled after ReceiveAssetsList with filtering by spendable balance
  - Shows only assets with balance > 0
  - Created 2024-12-09
  - Updated 2025-12-11: Added support for initialParams to auto-select source
    when navigating from asset overview screen.
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect, useRef } from 'react';
import { View, FlatList, TextInput as RNTextInput, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { List, Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import { useSelector } from 'react-redux';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { extractDisplaySubWallets } from '../../utils/subwallet/extractSubWallets';
import { extractLedgerData } from '../../utils/ledger/extractLedgerData';
import { API_GET_BALANCES, GENERAL, WYRE_SERVICE, API_SEND } from '../../utils/constants/intervalConstants';
import { USD } from '../../utils/constants/currencies';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import Colors from '../../globals/colors';
import BigNumber from 'bignumber.js';
import SendSourceSubwalletSheet from './components/SendSourceSubwalletSheet';
import { useSendWizard } from './SendWizardContext';

const SendWizardSelectSource = () => {
  const navigation = useNavigation();
  const { setSource, setStep, initialParams } = useSendWizard();
  const hasAutoSelected = useRef(false);

  const activeCoinsForUser = useObjectSelector((state) => state.coins.activeCoinsForUser);
  const allSubWallets = useObjectSelector((state) => extractDisplaySubWallets(state));
  const balances = useObjectSelector((state) => extractLedgerData(state, 'balances', API_GET_BALANCES));
  const rates = useObjectSelector((state) => state.ledger.rates);
  const displayCurrency = useSelector(
    (state) => state.settings.generalWalletSettings.displayCurrency || USD,
  );
  const showBalance = useSelector((state) => state.coins.showBalance);

  const [subwalletSheetVisible, setSubwalletSheetVisible] = useState(false);
  const [pendingCoin, setPendingCoin] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

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

  // Auto-select source if initialParams are provided (e.g., from asset overview)
  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (!initialParams?.initialCoinId) return;
    
    const coinObj = activeCoinsForUser.find((c) => c.id === initialParams.initialCoinId);
    if (!coinObj) return;

    const subWallets = allSubWallets[coinObj.id] || [];
    if (subWallets.length === 0) return;

    // Find the specified subwallet or the first one with balance
    let targetSubWallet = null;
    if (initialParams.initialSubWalletId) {
      targetSubWallet = subWallets.find((w) => w.id === initialParams.initialSubWalletId);
    }
    
    // If no specific subwallet or not found, use the first one with balance
    if (!targetSubWallet) {
      targetSubWallet = subWallets.find((wallet) => {
        const balance =
          balances[coinObj.id] &&
          balances[coinObj.id][wallet.id] &&
          balances[coinObj.id][wallet.id].total != null
            ? BigNumber(balances[coinObj.id][wallet.id].total)
            : BigNumber(0);
        return balance.isGreaterThan(0);
      });
    }

    if (targetSubWallet) {
      hasAutoSelected.current = true;
      // Auto-select after a brief delay to allow navigation to complete
      setTimeout(() => {
        selectAssetAndSubwallet(coinObj, targetSubWallet);
      }, 100);
    }
  }, [initialParams, activeCoinsForUser, allSubWallets, balances, selectAssetAndSubwallet]);

  const getRate = useCallback(
    (coinId) => {
      return rates[WYRE_SERVICE] &&
        rates[WYRE_SERVICE][coinId] &&
        rates[WYRE_SERVICE][coinId][displayCurrency]
        ? rates[WYRE_SERVICE][coinId][displayCurrency]
        : rates[GENERAL] &&
            rates[GENERAL][coinId] &&
            rates[GENERAL][coinId][displayCurrency]
        ? rates[GENERAL][coinId][displayCurrency]
        : null;
    },
    [rates, displayCurrency],
  );

  // Calculate total balance across all subwallets for each coin
  const getBalanceForCoin = useCallback(
    (coinObj) => {
      const subWallets = allSubWallets[coinObj.id] || [];
      let total = BigNumber(0);

      subWallets.forEach((wallet) => {
        const walletBalance =
          balances[coinObj.id] &&
          balances[coinObj.id][wallet.id] &&
          balances[coinObj.id][wallet.id].total != null
            ? BigNumber(balances[coinObj.id][wallet.id].total)
            : BigNumber(0);
        total = total.plus(walletBalance);
      });

      return total;
    },
    [allSubWallets, balances],
  );

  // Filter assets to only those with balance > 0 and subwallets
  const assets = useMemo(() => {
    return activeCoinsForUser
      .filter((coinObj) => {
        const subWallets = allSubWallets[coinObj.id] || [];
        if (subWallets.length === 0) return false;

        const total = getBalanceForCoin(coinObj);
        return total.isGreaterThan(0);
      })
      .map((coinObj) => {
        const crypto = getBalanceForCoin(coinObj);
        const rate = getRate(coinObj.id) || 0;
        const fiat = Number(crypto.multipliedBy(rate));

        return {
          coinObj,
          crypto: crypto.toNumber(),
          fiat,
        };
      })
      .sort((a, b) => b.fiat - a.fiat);
  }, [activeCoinsForUser, allSubWallets, getBalanceForCoin, getRate]);

  const filteredAssets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return assets;

    return assets.filter(({ coinObj }) => {
      const name = (coinObj.display_name || '').toLowerCase();
      const ticker = (coinObj.display_ticker || '').toLowerCase();
      const id = (coinObj.id || '').toLowerCase();

      return (
        name.includes(query) ||
        ticker.includes(query) ||
        id.includes(query)
      );
    });
  }, [assets, searchTerm]);

  const selectAssetAndSubwallet = useCallback(
    (coinObj, subWallet) => {
      if (!coinObj || !subWallet) return;

      // Get balance for this specific subwallet
      const walletBalance =
        balances[coinObj.id] &&
        balances[coinObj.id][subWallet.id] &&
        balances[coinObj.id][subWallet.id].total != null
          ? balances[coinObj.id][subWallet.id].total
          : 0;

      // Determine the channel to use for sending
      const channel = subWallet.api_channels?.[API_SEND] || null;

      setSource(coinObj, subWallet, walletBalance, channel);
      setStep(2);
      navigation.navigate('SendWizardSelectTarget');
    },
    [balances, setSource, setStep, navigation],
  );

  const handleAssetPress = useCallback(
    (coinObj) => {
      const subWallets = allSubWallets[coinObj.id] || [];
      if (subWallets.length === 0) return;

      // Filter subwallets to only those with balance > 0
      const subWalletsWithBalance = subWallets.filter((wallet) => {
        const balance =
          balances[coinObj.id] &&
          balances[coinObj.id][wallet.id] &&
          balances[coinObj.id][wallet.id].total != null
            ? BigNumber(balances[coinObj.id][wallet.id].total)
            : BigNumber(0);
        return balance.isGreaterThan(0);
      });

      if (subWalletsWithBalance.length === 0) return;

      if (subWalletsWithBalance.length === 1) {
        selectAssetAndSubwallet(coinObj, subWalletsWithBalance[0]);
      } else {
        setPendingCoin(coinObj);
        setSubwalletSheetVisible(true);
      }
    },
    [allSubWallets, balances, selectAssetAndSubwallet],
  );

  const pendingBalanceMap = useMemo(() => {
    if (!pendingCoin) return {};
    const coinBalances = balances[pendingCoin.id] || {};
    const map = {};
    (allSubWallets[pendingCoin.id] || []).forEach((wallet) => {
      const totalObj = coinBalances[wallet.id];
      const total = totalObj && totalObj.total != null ? Number(totalObj.total) : 0;
      map[wallet.id] = total;
    });
    return map;
  }, [pendingCoin, balances, allSubWallets]);

  // Filter to subwallets with balance for the sheet
  const pendingSubWalletsWithBalance = useMemo(() => {
    if (!pendingCoin) return [];
    return (allSubWallets[pendingCoin.id] || []).filter((wallet) => {
      const balance = pendingBalanceMap[wallet.id] || 0;
      return balance > 0;
    });
  }, [pendingCoin, allSubWallets, pendingBalanceMap]);

  const renderItem = useCallback(
    ({ item }) => {
      const { coinObj, fiat, crypto } = item;
      const fiatRounded = BigNumber(fiat).decimalPlaces(2, BigNumber.ROUND_HALF_UP);
      const [fiatFormatted] = formatCurrency({ amount: fiatRounded.toFixed(2), code: displayCurrency });
      const cryptoAmount = BigNumber(crypto || 0);
      const cryptoFormatted = cryptoAmount.isFinite()
        ? cryptoAmount.decimalPlaces(4, BigNumber.ROUND_DOWN).toFixed(4)
        : '0.0000';

      return (
        <List.Item
          onPress={() => handleAssetPress(coinObj)}
          rippleColor="transparent"
          title={() => (
            <View style={styles.titleRow}>
              <Text style={styles.title}>{coinObj.display_name}</Text>
              <Text style={styles.fiatValue}>
                {showBalance ? fiatFormatted : '*****'}
              </Text>
            </View>
          )}
          description={() => (
            <Text style={styles.cryptoValue}>
              {showBalance ? `${cryptoFormatted} ${coinObj.display_ticker}` : `*** ${coinObj.display_ticker}`}
            </Text>
          )}
          left={() => (
            <View style={styles.leftContainer}>{RenderSquareCoinLogo(coinObj.id, {}, 38, 38)}</View>
          )}
          style={styles.listItem}
          contentStyle={styles.listItemContent}
        />
      );
    },
    [displayCurrency, handleAssetPress, showBalance],
  );

  return (
    <View style={styles.listContainer}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={styles.mainTitle}>Select asset to send or convert</Text>
        <RNTextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search assets"
          placeholderTextColor="#999"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{
            height: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: searchFocused ? Colors.primaryColor : '#E0E0E0',
            paddingHorizontal: 14,
            fontSize: 15,
            color: '#1A1A1A',
            backgroundColor: '#F5F5F5',
            marginTop: 12,
          }}
        />
      </View>
      <FlatList
        data={filteredAssets}
        keyExtractor={(item) => item.coinObj.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 48 }}>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
              {searchTerm.trim().length > 0
                ? 'No assets match your search.'
                : 'No assets with balance available to send.'}
            </Text>
          </View>
        )}
      />
      {subwalletSheetVisible && pendingCoin && (
        <SendSourceSubwalletSheet
          visible={subwalletSheetVisible}
          coinObj={pendingCoin}
          subWallets={pendingSubWalletsWithBalance}
          balanceMap={pendingBalanceMap}
          onClose={() => {
            setSubwalletSheetVisible(false);
            setPendingCoin(null);
          }}
          onSelect={(wallet) => {
            setSubwalletSheetVisible(false);
            const coinRef = pendingCoin;
            setPendingCoin(null);
            selectAssetAndSubwallet(coinRef, wallet);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContent: {
    paddingBottom: 16,
  },
  listItem: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  listItemContent: {
    paddingVertical: 0,
  },
  leftContainer: {
    paddingRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fiatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 12,
  },
  cryptoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    marginTop: 6,
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
});

export default SendWizardSelectSource;

