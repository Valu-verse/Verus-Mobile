/*
  New file: ReceiveAssetsList
  - Lists activated assets with balances in fiat/crypto for selecting a receive target
  - Navigates to the redesigned receive flow after the user taps an asset
  - Rounds fiat balances to two decimals before formatting to prevent incorrect separators
  - Updated 2025-11-25: Matched visual style to Wallet screen (square icons, clean layout, masked header)
  - Updated 2025-11-29: Ensure coin ticker remains visible when balance is hidden
*/

import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, FlatList, TextInput as RNTextInput, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { List, Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import { useDispatch, useSelector } from 'react-redux';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { extractDisplaySubWallets } from '../../utils/subwallet/extractSubWallets';
import { extractLedgerData } from '../../utils/ledger/extractLedgerData';
import { API_GET_BALANCES, GENERAL, WYRE_SERVICE } from '../../utils/constants/intervalConstants';
import { USD } from '../../utils/constants/currencies';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import { normalizeNum } from '../../utils/normalizeNum';
import Colors from '../../globals/colors';
import BigNumber from 'bignumber.js';
import ReceiveSubwalletSheet from './ReceiveSubwalletSheet';
import {
  setActiveApp,
  setActiveCoin,
  setActiveSection,
  setCoinSubWallet,
} from '../../actions/actionCreators';
import { WALLET_APP_RECEIVE } from '../../utils/constants/apps';

const ReceiveAssetsList = () => {
  const navigation = useNavigation();

  const activeCoinsForUser = useObjectSelector((state) => state.coins.activeCoinsForUser);
  const allSubWallets = useObjectSelector((state) => extractDisplaySubWallets(state));
  const balances = useObjectSelector((state) => extractLedgerData(state, 'balances', API_GET_BALANCES));
  const rates = useObjectSelector((state) => state.ledger.rates);
  const displayCurrency = useSelector(
    (state) => state.settings.generalWalletSettings.displayCurrency || USD,
  );
  const showBalance = useSelector((state) => state.coins.showBalance);
  const dispatch = useDispatch();
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

  const assets = useMemo(() => {
    return activeCoinsForUser
      .filter((coinObj) => (allSubWallets[coinObj.id] || []).length > 0)
      .map((coinObj) => {
        const subWallets = allSubWallets[coinObj.id] || [];
        let crypto = BigNumber(0);
        subWallets.forEach((wallet) => {
          const total =
            balances[coinObj.id] &&
            balances[coinObj.id][wallet.id] &&
            balances[coinObj.id][wallet.id].total != null
              ? BigNumber(balances[coinObj.id][wallet.id].total)
              : BigNumber(0);
          crypto = crypto.plus(total);
        });

        const rate = getRate(coinObj.id) || 0;
        const fiat = Number(crypto.multipliedBy(rate));

        return {
          coinObj,
          crypto: crypto.toNumber(),
          fiat,
        };
      })
      .sort((a, b) => b.fiat - a.fiat);
  }, [activeCoinsForUser, allSubWallets, balances, getRate]);

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

  const navigateToDetail = useCallback(
    (coinObj, subWallet) => {
      if (!coinObj || !subWallet) return;

      const appKey = coinObj.default_app;
      const appSections = coinObj.apps && coinObj.apps[appKey] ? coinObj.apps[appKey].data : [];
      const receiveSection = appSections.find((section) => section.key === WALLET_APP_RECEIVE) || appSections[0];

      dispatch(setActiveCoin(coinObj));
      dispatch(setActiveApp(appKey));
      if (receiveSection) dispatch(setActiveSection(receiveSection));
      dispatch(setCoinSubWallet(coinObj.id, subWallet));

      navigation.navigate('ReceiveAssetDetails', {
        coinId: coinObj.id,
        subWalletId: subWallet.id,
      });
    },
    [dispatch, navigation],
  );

  const handleAssetPress = useCallback(
    (coinObj) => {
      const subWallets = allSubWallets[coinObj.id] || [];
      if (subWallets.length === 0) return;

      if (subWallets.length === 1) {
        navigateToDetail(coinObj, subWallets[0]);
      } else {
        setPendingCoin(coinObj);
        setSubwalletSheetVisible(true);
      }
    },
    [allSubWallets, navigateToDetail],
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
        <Text style={styles.mainTitle}>Receive assets</Text>
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
          }}
        />
      </View>
      <FlatList
        data={filteredAssets}
        keyExtractor={(item) => item.coinObj.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
              {searchTerm.trim().length > 0
                ? 'No assets match your search.'
                : 'No assets available yet.'}
            </Text>
          </View>
        )}
      />
      {subwalletSheetVisible && pendingCoin && (
        <ReceiveSubwalletSheet
          visible={subwalletSheetVisible}
          coinObj={pendingCoin}
          subWallets={allSubWallets[pendingCoin.id] || []}
          balanceMap={pendingBalanceMap}
          onClose={() => {
            setSubwalletSheetVisible(false);
            setPendingCoin(null);
          }}
          onSelect={(wallet) => {
            setSubwalletSheetVisible(false);
            const coinRef = pendingCoin;
            setPendingCoin(null);
            navigateToDetail(coinRef, wallet);
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
    marginBottom: 16,
    marginTop: 8,
  },
});

export default ReceiveAssetsList;


