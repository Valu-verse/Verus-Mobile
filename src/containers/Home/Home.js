/*
  Home (Wallet)
  - 2025-11-21: Renamed to Wallet. 
  - Merged Assets functionality.
  - Removed widgets (moved to Services).
  - 2025-11-22: Removed legacy drawer close call (bottom tabs own settings).
*/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  setActiveCoin,
  setActiveApp,
  setActiveSection,
  expireCoinData,
  setCoinSubWallet,
  expireServiceData,
  saveGeneralSettings,
} from '../../actions/actionCreators';
import { CommonActions, useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  API_GET_FIATPRICE,
  API_GET_BALANCES,
  API_GET_INFO,
  GENERAL,
  WYRE_SERVICE,
  API_GET_SERVICE_ACCOUNT,
  API_GET_SERVICE_PAYMENT_METHODS,
  API_GET_SERVICE_RATES,
  API_GET_SERVICE_NOTIFICATIONS,
} from '../../utils/constants/intervalConstants';
import { USD } from '../../utils/constants/currencies';
import {
  conditionallyUpdateService,
  conditionallyUpdateWallet,
} from '../../actions/actionDispatchers';
import BigNumber from 'bignumber.js';
import {
  extractLedgerData,
} from '../../utils/ledger/extractLedgerData';
import { requestAttestationData } from '../../utils/auth/authBox';
import { ATTESTATIONS_PROVISIONED } from '../../utils/constants/attestations';
import { HomeRender } from './Home.render';
import { extractDisplaySubWallets } from '../../utils/subwallet/extractSubWallets';
import { createAlert } from '../../actions/actions/alert/dispatchers/alert';
import { VALU_SERVICE_ID } from '../../utils/constants/services';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import {
  openAddErc20TokenModal,
  openAddPbaasCurrencyModal,
} from '../../actions/actions/sendModal/dispatchers/sendModal';
import { useSelector, useDispatch } from 'react-redux';
import store from '../../store';
import { useObjectSelector } from '../../hooks/useObjectSelector';

const Home = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const activeCoinsForUser = useObjectSelector((state) => state.coins.activeCoinsForUser);

  const activeAccount = useObjectSelector((state) => state.authentication.activeAccount);
  const testnetOverrides = useObjectSelector(
    (state) => state.authentication.activeAccount ? state.authentication.activeAccount.testnetOverrides : {},
  );
  const balances = useObjectSelector((state) =>
    extractLedgerData(state, 'balances', API_GET_BALANCES),
  );
  const rates = useObjectSelector((state) => state.ledger.rates);
  const attestation = useSelector((state) => state.attestation);
  const allSubWallets = useObjectSelector((state) => extractDisplaySubWallets(state));
  const activeSubWallets = useObjectSelector((state) => state.coinMenus.activeSubWallets);
  
  const displayCurrency = useSelector(
    (state) => state.settings.generalWalletSettings.displayCurrency || USD,
  );
  const showBalance = useSelector((state) => state.coins.showBalance);

  const [activeCategory, setActiveCategory] = useState('crypto');
  const [loading, setLoading] = useState(false);
  const [displayCurrencyModalOpen, setDisplayCurrencyModalOpen] = useState(false);
  const [buySellSheetVisible, setBuySellSheetVisible] = useState(false);
  const [transferSheetVisible, setTransferSheetVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [hasValuProofOfPersonhood, setHasValuProofOfPersonhood] = useState(false);

  useEffect(() => {
    // Check for specific "Valu Proof of Personhood" attestation
    const checkForValuProofOfPersonhood = async () => {
      if (attestation && attestation.attestations_provisioned) {
        try {
          const attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
          if (attestationData) {
            // Check if any attestation has the name "Valu Proof of Personhood"
            const hasValuAttestation = Object.values(attestationData).some(attestationItem => 
              attestationItem && 
              typeof attestationItem === 'object' && 
              attestationItem.name === "Valu Proof of Personhood"
            );
            setHasValuProofOfPersonhood(hasValuAttestation);
          } else {
            setHasValuProofOfPersonhood(false);
          }
        } catch (e) {
          console.warn('Could not check attestations:', e.message);
          setHasValuProofOfPersonhood(false);
        }
      } else {
        setHasValuProofOfPersonhood(false);
      }
    };

    checkForValuProofOfPersonhood();
  }, [attestation]);

  const setDisplayCurrencyFunc = async (currency) => {
    try {
      dispatch(await saveGeneralSettings({ displayCurrency: currency }));
    } catch (e) {
      createAlert('Error setting display currency', e.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refresh(false);
      return () => {};
    }, []),
  );

  const refresh = useCallback(
    async (showLoading = true) => {
      setLoading(showLoading);

      const serviceUpdates = [
        API_GET_SERVICE_ACCOUNT,
        API_GET_SERVICE_PAYMENT_METHODS,
        API_GET_SERVICE_RATES,
        API_GET_SERVICE_NOTIFICATIONS,
      ];

      const coinUpdates = [API_GET_FIATPRICE, API_GET_BALANCES, API_GET_INFO];

      const updates = [
        {
          keys: serviceUpdates,
          update: conditionallyUpdateService,
          params: [[dispatch]],
        },
        {
          keys: coinUpdates,
          update: conditionallyUpdateWallet,
          params: activeCoinsForUser.map((coinObj) => {
            return [dispatch, coinObj.id];
          }),
        },
      ];

      for (const update of updates) {
        for (const key of update.keys) {
          try {
            for (const paramList of update.params) {
              await update.update(store.getState(), ...paramList, key);
            }
          } catch (e) {
            console.warn('Error forcing update to ' + key);
            console.warn(e);
          }
        }
      }

      setLoading(false);
    },
    [activeCoinsForUser, dispatch],
  );

  const resetToScreen = (route, title, data) => {
    const resetAction = CommonActions.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: route, params: { title: title, data: data } },
      ],
    });

    navigation?.closeDrawer?.();
    navigation.dispatch(resetAction);
  };

  const forceUpdate = () => {
    activeCoinsForUser.forEach((coinObj) => {
      dispatch(expireCoinData(coinObj.id, API_GET_FIATPRICE));
      dispatch(expireCoinData(coinObj.id, API_GET_BALANCES));
      dispatch(expireCoinData(coinObj.id, API_GET_INFO));
    });

    dispatch(expireServiceData(API_GET_SERVICE_ACCOUNT));
    dispatch(expireServiceData(API_GET_SERVICE_PAYMENT_METHODS));
    dispatch(expireServiceData(API_GET_SERVICE_RATES));
    dispatch(expireServiceData(API_GET_SERVICE_NOTIFICATIONS));

    refresh();
  };

  const getRate = useCallback((coinId, currency) => {
    return rates[WYRE_SERVICE] &&
      rates[WYRE_SERVICE][coinId] &&
      rates[WYRE_SERVICE][coinId][currency]
      ? rates[WYRE_SERVICE][coinId][currency]
      : rates[GENERAL] &&
        rates[GENERAL][coinId] &&
        rates[GENERAL][coinId][currency]
      ? rates[GENERAL][coinId][currency]
      : null;
  }, [rates]);

  const cryptoAssets = useMemo(() => {
    return activeCoinsForUser.map((coinObj) => {
      const subWallets = allSubWallets[coinObj.id] || [];
      let crypto = BigNumber(0);
      subWallets.forEach((wallet) => {
        if (balances[coinObj.id] && balances[coinObj.id][wallet.id] && balances[coinObj.id][wallet.id].total != null) {
          crypto = crypto.plus(BigNumber(balances[coinObj.id][wallet.id].total));
        }
      });
      const rate = getRate(coinObj.id, displayCurrency) || 0;
      const fiat = Number(BigNumber(crypto).multipliedBy(rate));
      return { coinObj, crypto: crypto.toNumber(), fiat };
    }).sort((a, b) => b.fiat - a.fiat);
  }, [activeCoinsForUser, allSubWallets, balances, displayCurrency, getRate]);

  const _verusPay = () => {
    navigation.navigate('VerusPay');
  };

  const openCoin = (coinObj) => {
    const subWallets = allSubWallets[coinObj.id];
    const subWallet = activeSubWallets[coinObj.id] ? activeSubWallets[coinObj.id] : subWallets[0];
    
    if (subWallet != null) {
      dispatch(setCoinSubWallet(coinObj.id, subWallet));
    }
    dispatch(setActiveCoin(coinObj));
    dispatch(setActiveApp(coinObj.default_app));
    dispatch(setActiveSection(coinObj.apps[coinObj.default_app].data[0]));

    resetToScreen('CoinMenus', 'Overview');
  };

  const _addCoin = () => {
    navigation.navigate('AddCoin', { refresh: refresh });
  };

  const _addPbaasCurrency = async () => {
    openAddPbaasCurrencyModal(
      CoinDirectory.findCoinObj(testnetOverrides.VRSC ? testnetOverrides.VRSC : 'VRSC'),
    );
  };

  const _addErc20Token = () => {
    openAddErc20TokenModal(
      CoinDirectory.findCoinObj(testnetOverrides.ETH ? testnetOverrides.ETH : 'ETH'),
    );
  };

  const _openOnOffRamp = () => {
    setBuySellSheetVisible(true);
  };

  const _handleBuySellComplete = ({ action, address }) => {
    setBuySellSheetVisible(false);
    navigation.navigate('Service', {
      service: VALU_SERVICE_ID,
      subScreen: action === 'sell' ? 'offRamp' : 'onRamp',
      subScreenData: { initialAddress: address }
    });
  };

  const _openTransferSheet = () => {
    setTransferSheetVisible(true);
  };

  const _handleTransferReceive = () => {
    setTransferSheetVisible(false);
    navigation.navigate('ReceiveAssetsList');
  };

  const _handleTransferSendConvert = () => {
    setTransferSheetVisible(false);
  };

  return (
    <HomeRender
      displayCurrencyModalOpen={displayCurrencyModalOpen}
      displayCurrency={displayCurrency}
      setDisplayCurrency={setDisplayCurrencyFunc}
      setDisplayCurrencyModalOpen={setDisplayCurrencyModalOpen}
      _addCoin={_addCoin}
      _verusPay={_verusPay}
      _addPbaasCurrency={_addPbaasCurrency}
      _addErc20Token={_addErc20Token}
      handleOpenOnOffRamp={_openOnOffRamp}
      buySellSheetVisible={buySellSheetVisible}
      setBuySellSheetVisible={setBuySellSheetVisible}
      handleBuySellComplete={_handleBuySellComplete}
      handleTransferPress={_openTransferSheet}
      transferSheetVisible={transferSheetVisible}
      setTransferSheetVisible={setTransferSheetVisible}
      handleTransferReceive={_handleTransferReceive}
      handleTransferSendConvert={_handleTransferSendConvert}
      forceUpdate={forceUpdate}
      loading={loading}
      activeCategory={activeCategory}
      setActiveCategory={setActiveCategory}
      assets={cryptoAssets}
      identities={[]}
      identitiesPlaceholder="You don't have any identities yet."
      showBalance={showBalance}
      openCoin={openCoin}
      manageVisible={manageVisible}
      setManageVisible={setManageVisible}
      hasValuProofOfPersonhood={hasValuProofOfPersonhood}
    />
  );
};

export default Home;