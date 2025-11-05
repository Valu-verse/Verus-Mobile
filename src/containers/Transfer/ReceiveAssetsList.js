/*
  New file: ReceiveAssetsList
  - Lists activated assets with balances in fiat/crypto for selecting a receive target
  - Navigates to the redesigned receive flow after the user taps an asset
  - Rounds fiat balances to two decimals before formatting to prevent incorrect separators
*/

import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, FlatList, TextInput as RNTextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { List, Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import { useDispatch, useSelector } from 'react-redux';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { extractDisplaySubWallets } from '../../utils/subwallet/extractSubWallets';
import { extractLedgerData } from '../../utils/ledger/extractLedgerData';
import { API_GET_BALANCES, GENERAL, WYRE_SERVICE } from '../../utils/constants/intervalConstants';
import { USD } from '../../utils/constants/currencies';
import { getCoinLogo } from '../../utils/CoinData/CoinData';
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
      title: 'Receive assets',
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
      const Logo = getCoinLogo(coinObj.id, coinObj.proto);
      const fiatRounded = BigNumber(fiat).decimalPlaces(2, BigNumber.ROUND_HALF_UP);
      const [fiatFormatted] = formatCurrency({ amount: fiatRounded.toFixed(2), code: displayCurrency });
      const [cryptoFormatted] = normalizeNum(Number(crypto), coinObj.decimals || 8);

      return (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 12,
            backgroundColor: 'white',
          }}
        >
          <List.Item
            title={coinObj.display_name}
            description={coinObj.display_ticker}
            onPress={() => handleAssetPress(coinObj)}
            left={(props) => (
              <View
                style={{
                  width: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: coinObj.theme_color || Colors.primaryColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {Logo ? (
                    <Logo width={18} height={18} />
                  ) : (
                    <List.Icon {...props} color={'white'} icon="wallet" />
                  )}
                </View>
              </View>
            )}
            right={(props) => (
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'black' }}>
                  {showBalance ? fiatFormatted : '*****'}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {showBalance ? `${cryptoFormatted} ${coinObj.display_ticker}` : '***'}
                </Text>
              </View>
            )}
            titleStyle={{ fontSize: 16, fontWeight: '600' }}
            descriptionStyle={{ fontSize: 12, color: '#666', marginTop: 2 }}
            style={{ backgroundColor: 'transparent' }}
          />
        </View>
      );
    },
    [displayCurrency, handleAssetPress, showBalance],
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: 'black' }}>
          {'Choose an asset to receive'}
        </Text>
        <Text style={{ fontSize: 14, color: '#666', marginTop: 6 }}>
          {'Select the asset you would like to receive into your wallet.'}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 }}>
          {'Search assets'}
        </Text>
        <RNTextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search by name or ticker"
          placeholderTextColor="#999"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{
            height: 48,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: searchFocused ? Colors.primaryColor : '#E0E0E0',
            paddingHorizontal: 14,
            fontSize: 15,
            color: '#1A1A1A',
            backgroundColor: '#FAFAFA',
          }}
        />
      </View>
      <FlatList
        data={filteredAssets}
        keyExtractor={(item) => item.coinObj.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 24, flexGrow: filteredAssets.length === 0 ? 1 : 0 }}
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

export default ReceiveAssetsList;


