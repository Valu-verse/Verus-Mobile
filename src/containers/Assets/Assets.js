/*
  New file: Assets
  - Renders a list of user assets with logo/name (left) and fiat value + crypto amount (right)
  - Sorted by fiat value descending; includes zero-balance assets
  - Tapping a row navigates to CoinMenus via existing openCoin flow
  - Header-right button opens ManageAssetsSheet (arrange option hidden)
*/
import React, { useMemo, useState, useLayoutEffect, useCallback } from 'react';
import { View } from 'react-native';
import AssetsRender from './Assets.render';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { extractDisplaySubWallets } from '../../utils/subwallet/extractSubWallets';
import { extractLedgerData } from '../../utils/ledger/extractLedgerData';
import { API_GET_BALANCES, GENERAL, WYRE_SERVICE } from '../../utils/constants/intervalConstants';
import { USD } from '../../utils/constants/currencies';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import BigNumber from 'bignumber.js';
import { setActiveCoin, setActiveApp, setActiveSection, setCoinSubWallet } from '../../actions/actionCreators';
import Colors from '../../globals/colors';
import ManageAssetsSheet from '../Home/HomeFAB/ManageAssetsSheet';
import HomeFAB from '../Home/HomeFAB/HomeFAB';
import TransferSheet from '../Home/HomeFAB/TransferSheet';
import BuySellSheet from '../Services/ServiceComponents/ValuService/BuySellSheet/BuySellSheet';
import { VALU_SERVICE_ID } from '../../utils/constants/services';
import { Portal } from 'react-native-paper';
import {
  openAddErc20TokenModal,
  openAddPbaasCurrencyModal,
} from '../../actions/actions/sendModal/dispatchers/sendModal';

const Assets = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const activeCoinsForUser = useObjectSelector((state) => state.coins.activeCoinsForUser);
  const allSubWallets = useObjectSelector((state) => extractDisplaySubWallets(state));
  const balances = useObjectSelector((state) => extractLedgerData(state, 'balances', API_GET_BALANCES));
  const rates = useObjectSelector((state) => state.ledger.rates);
  const testnetOverrides = useObjectSelector(
    (state) => state.authentication.activeAccount?.testnetOverrides,
  );
  const displayCurrency = useSelector((state) => state.settings.generalWalletSettings.displayCurrency || USD);
  const showBalance = useSelector((state) => state.coins.showBalance);

  const [manageVisible, setManageVisible] = useState(false);
  const [buySellSheetVisible, setBuySellSheetVisible] = useState(false);
  const [transferSheetVisible, setTransferSheetVisible] = useState(false);

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

  const assets = useMemo(() => {
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

  const openCoin = (coinObj) => {
    const subWallets = allSubWallets[coinObj.id] || [];
    const subWallet = subWallets[0];
    if (subWallet != null) {
      dispatch(setCoinSubWallet(coinObj.id, subWallet));
    }
    dispatch(setActiveCoin(coinObj));
    dispatch(setActiveApp(coinObj.default_app));
    dispatch(setActiveSection(coinObj.apps[coinObj.default_app].data[0]));
    navigation.navigate('CoinMenus');
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

  const _handleTransferReceive = () => {
    setTransferSheetVisible(false);
    navigation.navigate('ReceiveAssetsList');
  };

  const _handleTransferSendConvert = () => {
    setTransferSheetVisible(false);
    navigation.navigate('SendWizard');
  };

  const _addPbaasCurrency = async () => {
    openAddPbaasCurrencyModal(
      CoinDirectory.findCoinObj(
        testnetOverrides?.VRSC ? testnetOverrides.VRSC : 'VRSC',
      ),
    );
  };

  const _addErc20Token = () => {
    openAddErc20TokenModal(
      CoinDirectory.findCoinObj(
        testnetOverrides?.ETH ? testnetOverrides.ETH : 'ETH',
      ),
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitleVisible: false,
      headerBackTitle: '',
    });
  }, [navigation]);

  return (
    <Portal.Host>
      <AssetsRender.List
        assets={assets}
        displayCurrency={displayCurrency}
        showBalance={showBalance}
        onPressAsset={(coinObj) => openCoin(coinObj)}
        onPressAddAssets={() => setManageVisible(true)}
      />
      {/* Shared HomeFAB for consistent bottom placement within this screen */}
      <HomeFAB
        handleOpenOnOffRamp={_openOnOffRamp}
        handleTransfer={() => setTransferSheetVisible(true)}
      />
      {buySellSheetVisible && (
        <BuySellSheet
          visible={true}
          onClose={() => setBuySellSheetVisible(false)}
          onComplete={_handleBuySellComplete}
        />
      )}
      {transferSheetVisible && (
        <TransferSheet
          visible={true}
          onClose={() => setTransferSheetVisible(false)}
          onSelectReceive={_handleTransferReceive}
          onSelectSendConvert={_handleTransferSendConvert}
        />
      )}
      <ManageAssetsSheet
        visible={manageVisible}
        onClose={() => setManageVisible(false)}
        showConfigureHomeCards={false}
        onBrowseAll={() => navigation.navigate('AddCoin')}
        onAddErc20={_addErc20Token}
        onAddPbaas={_addPbaasCurrency}
        onArrangeCards={() => {}}
      />
    </Portal.Host>
  );
};

export default Assets;


