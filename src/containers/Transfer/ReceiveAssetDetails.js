/*
  New file: ReceiveAssetDetails
  - Redesigned receive experience with inline QR preview, address actions, and invoice creation controls
  - Supports subwallet switching and VerusPay invoice generation (logic to be shared via helper next step)
*/

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, ScrollView, Clipboard, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Text, Button, TextInput, Checkbox, IconButton, Divider } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { extractDisplaySubWallets } from '../../utils/subwallet/extractSubWallets';
import selectAddresses from '../../selectors/address';
import selectRates from '../../selectors/rates';
import {
  setActiveCoin,
  setActiveApp,
  setActiveSection,
  setCoinSubWallet,
  expireCoinData,
} from '../../actions/actionCreators';
import { WALLET_APP_RECEIVE } from '../../utils/constants/apps';
import ReceiveSubwalletSheet from './ReceiveSubwalletSheet';
import Colors from '../../globals/colors';
import AnimatedActivityIndicatorBox from '../../components/AnimatedActivityIndicatorBox';
import { createAlert } from '../../actions/actions/alert/dispatchers/alert';
import { isNumber, truncateDecimal } from '../../utils/math';
import {
  sanitizeNumericInput,
  validateAmountInput,
  validateSlippageInput,
  generateReceiveInvoice,
} from '../../features/receive/receiveInvoice';
import { API_GET_FIATPRICE, API_GET_BALANCES, DLIGHT_PRIVATE } from '../../utils/constants/intervalConstants';

const chipStyles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  label: {
    fontSize: 12,
    color: '#333333',
    fontWeight: '500',
  },
};

const ReceiveAssetDetails = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  const { coinId, subWalletId } = route.params || {};

  const coinObj = useMemo(() => (coinId ? CoinDirectory.findCoinObj(coinId) : null), [coinId]);
  const allSubWallets = useObjectSelector((state) => extractDisplaySubWallets(state));
  const availableSubWallets = useMemo(() => {
    if (!coinObj) return [];
    return allSubWallets[coinObj.id] || [];
  }, [allSubWallets, coinObj]);

  const [selectedSubWalletId, setSelectedSubWalletId] = useState(subWalletId || (availableSubWallets[0]?.id ?? null));
  const [subwalletSheetVisible, setSubwalletSheetVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountFiat, setAmountFiat] = useState(false);
  const [allowConversion, setAllowConversion] = useState(false);
  const [maxSlippage, setMaxSlippage] = useState('0.5');
  const [qrValue, setQrValue] = useState('-');
  const [showingInvoice, setShowingInvoice] = useState(false);
  const [showVerusIcon, setShowVerusIcon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ amount: null, maxSlippage: null });

  const selectedSubWallet = useMemo(() => {
    if (!availableSubWallets.length) return null;
    return availableSubWallets.find((wallet) => wallet.id === selectedSubWalletId) || availableSubWallets[0];
  }, [availableSubWallets, selectedSubWalletId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: coinObj ? `Receive ${coinObj.display_ticker}` : 'Receive',
    });
  }, [coinObj, navigation]);

  useEffect(() => {
    if (coinObj && selectedSubWallet) {
      const appKey = coinObj.default_app;
      const appSections = coinObj.apps && coinObj.apps[appKey] ? coinObj.apps[appKey].data : [];
      const receiveSection = appSections.find((section) => section.key === WALLET_APP_RECEIVE) || appSections[0];

      dispatch(setActiveCoin(coinObj));
      dispatch(setActiveApp(appKey));
      if (receiveSection) dispatch(setActiveSection(receiveSection));
      dispatch(setCoinSubWallet(coinObj.id, selectedSubWallet));
      dispatch(expireCoinData(coinObj.id, API_GET_FIATPRICE));
      dispatch(expireCoinData(coinObj.id, API_GET_BALANCES));
    }
  }, [coinObj, selectedSubWallet, dispatch]);

  useEffect(() => {
    if (
      !coinObj ||
      !selectedSubWallet ||
      selectedSubWallet.id === 'PRIVATE_WALLET' ||
      selectedSubWallet.channel === DLIGHT_PRIVATE
    ) {
      setAllowConversion(false);
    }
  }, [coinObj, selectedSubWallet]);

  const addressesData = useSelector(selectAddresses);
  const address = useMemo(() => {
    return addressesData && Array.isArray(addressesData.results) && addressesData.results.length > 0
      ? addressesData.results[0]
      : null;
  }, [addressesData]);

  const ratesData = useSelector(selectRates);
  const priceMap = ratesData && ratesData.results ? ratesData.results : {};

  const displayCurrency = useSelector(
    (state) => state.settings.generalWalletSettings.displayCurrency || 'USD',
  );
  const generalSettings = useSelector((state) => state.settings.generalWalletSettings);

  useEffect(() => {
    if (address && !showingInvoice) {
      setQrValue(address);
      setShowVerusIcon(false);
    }
  }, [address, showingInvoice]);

  const conversionEligible = useMemo(() => {
    if (!coinObj || !selectedSubWallet) return false;
    return coinObj.proto === 'vrsc' && selectedSubWallet.id !== 'PRIVATE_WALLET';
  }, [coinObj, selectedSubWallet]);

  const amountPreview = useMemo(() => {
    if (!amount || !coinObj) return null;

    const processed = sanitizeNumericInput(amount.toString());
    if (!isNumber(processed)) return null;

    const price = priceMap ? priceMap[displayCurrency] : null;
    if (!price || Number(price) <= 0) return null;

    if (amountFiat) {
      const crypto = truncateDecimal(Number(processed) / Number(price), 8);
      return `≈ ${crypto} ${coinObj.display_ticker}`;
    } else {
      const fiatValue = truncateDecimal(Number(processed) * Number(price), 2);
      return `≈ ${fiatValue} ${displayCurrency}`;
    }
  }, [amount, amountFiat, coinObj, displayCurrency, priceMap]);

  const resetToAddressQr = useCallback(() => {
    if (address) {
      setQrValue(address);
      setShowingInvoice(false);
      setShowVerusIcon(false);
    }
  }, [address]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    Clipboard.setString(address);
    createAlert('Address copied', `${address} copied to clipboard.`);
  }, [address]);

  const validateInputs = useCallback(() => {
    const sanitizedAmount = sanitizeNumericInput(amount);
    const sanitizedSlippage = sanitizeNumericInput(maxSlippage);

    const amountError = validateAmountInput(sanitizedAmount);
    const slippageError = allowConversion && conversionEligible && generalSettings.allowSettingVerusPaySlippage
      ? validateSlippageInput(sanitizedSlippage)
      : null;

    if (amountError) {
      createAlert('Invalid amount', amountError);
    }

    if (slippageError) {
      createAlert('Invalid slippage', slippageError);
    }

    setErrors({
      amount: amountError,
      maxSlippage: slippageError,
    });

    return !amountError && !slippageError
      ? { amount: sanitizedAmount, maxSlippage: sanitizedSlippage }
      : null;
  }, [amount, allowConversion, conversionEligible, generalSettings.allowSettingVerusPaySlippage, maxSlippage]);

  const createInvoice = useCallback(
    async (processedAmount, processedSlippage) => {
      if (!coinObj || !selectedSubWallet || !address) {
        createAlert('Missing data', 'Unable to create invoice without an address.');
        return;
      }

      setLoading(true);
      try {
        const { qrString, showVerusIcon } = await generateReceiveInvoice({
          coinObj,
          subWallet: selectedSubWallet,
          address,
          amountValue: processedAmount,
          amountFiat,
          memo: undefined,
          allowConversion: allowConversion && conversionEligible,
          maxSlippageValue: processedSlippage,
          displayCurrency,
          priceMap,
        });

        setQrValue(qrString);
        setShowVerusIcon(showVerusIcon);
        setShowingInvoice(true);
      } catch (e) {
        console.warn(e);
        createAlert('Error', e.message || 'Error creating VerusPay invoice.');
      } finally {
        setLoading(false);
      }
    },
    [address, allowConversion, amountFiat, coinObj, conversionEligible, displayCurrency, priceMap, selectedSubWallet],
  );

  const handleGenerateInvoice = useCallback(() => {
    const validated = validateInputs();
    if (!validated) return;

    createInvoice(validated.amount, validated.maxSlippage || '');
  }, [createInvoice, validateInputs]);

  if (!coinObj) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>{'Asset not found.'}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 14,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#00000010',
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: 'black' }}>{coinObj.display_name}</Text>
              <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                {selectedSubWallet ? selectedSubWallet.name : 'Wallet'}
              </Text>
            </View>
            {availableSubWallets.length > 1 && (
              <TouchableOpacity
                onPress={() => setSubwalletSheetVisible(true)}
                style={chipStyles.container}
                activeOpacity={0.7}
              >
                <Text style={chipStyles.label}>{'Change address'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <QRCode
              value={qrValue || '-'}
              size={232}
              logo={showVerusIcon ? require('../../images/customIcons/Verus.png') : undefined}
              logoSize={showVerusIcon ? 56 : undefined}
              logoBackgroundColor={showVerusIcon ? 'white' : undefined}
              logoBorderRadius={showVerusIcon ? 100 : undefined}
            />
            <Text style={{ fontSize: 13, color: '#666', marginTop: 10 }}>
              {showingInvoice ? 'VerusPay invoice QR' : 'Wallet address QR'}
            </Text>
            {showingInvoice && (
              <Button
                style={{ marginTop: 6 }}
                textColor={Colors.primaryColor}
                onPress={resetToAddressQr}
              >
                {'Show address QR'}
              </Button>
            )}
          </View>
        </View>

        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Address</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: 'black' }} numberOfLines={2}>
              {address || 'Fetching address…'}
            </Text>
          </View>
          <IconButton
            icon="content-copy"
            onPress={copyAddress}
            iconColor={Colors.primaryColor}
          />
        </View>

        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: 'black', marginBottom: 10 }}>
            {'Invoice amount'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <TextInput
                mode="outlined"
                label={amountFiat ? displayCurrency : coinObj.display_ticker}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                error={errors.amount != null}
              />
              {errors.amount && (
                <Text style={{ fontSize: 12, color: Colors.warningButtonColor, marginTop: 4 }}>
                  {errors.amount}
                </Text>
              )}
            </View>
            <Button
              mode="outlined"
              textColor={Colors.primaryColor}
              style={{ borderRadius: 18, borderColor: Colors.primaryColor }}
              onPress={() => setAmountFiat(!amountFiat)}
            >
              {amountFiat ? coinObj.display_ticker : displayCurrency}
            </Button>
          </View>
          {amountPreview && (
            <Text style={{ fontSize: 11, color: '#666', marginTop: 6 }}>{amountPreview}</Text>
          )}
        </View>

        {conversionEligible && Number(amount.replace(/,/g, '.')) > 0 && (
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <Checkbox.Item
              label={'Allow payment with conversion from a PBaaS currency'}
              status={allowConversion ? 'checked' : 'unchecked'}
              onPress={() => setAllowConversion(!allowConversion)}
              color={Colors.primaryColor}
              uncheckedColor={'#C0C0C0'}
            />
            {generalSettings.allowSettingVerusPaySlippage && allowConversion && (
              <View style={{ marginTop: 10 }}>
                <Divider style={{ marginBottom: 10 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: 'black', marginBottom: 6 }}>
                  {'Maximum slippage (%)'}
                </Text>
                <TextInput
                  mode="outlined"
                  value={maxSlippage}
                  onChangeText={setMaxSlippage}
                  keyboardType="decimal-pad"
                  error={errors.maxSlippage != null}
                />
                {errors.maxSlippage && (
                  <Text style={{ fontSize: 12, color: Colors.warningButtonColor, marginTop: 4 }}>
                    {errors.maxSlippage}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleGenerateInvoice}
          disabled={loading || !address}
          style={{ borderRadius: 20, paddingVertical: 6, marginTop: 4 }}
        >
          {loading ? 'Generating…' : 'Generate invoice'}
        </Button>
      </ScrollView>

      {loading && <AnimatedActivityIndicatorBox />}

      {subwalletSheetVisible && (
        <ReceiveSubwalletSheet
          visible={subwalletSheetVisible}
          coinObj={coinObj}
          subWallets={availableSubWallets}
          onClose={() => setSubwalletSheetVisible(false)}
          onSelect={(wallet) => {
            setSubwalletSheetVisible(false);
            setSelectedSubWalletId(wallet.id);
            setShowingInvoice(false);
            setShowVerusIcon(false);
          }}
        />
      )}
    </View>
  );
};

export default ReceiveAssetDetails;


