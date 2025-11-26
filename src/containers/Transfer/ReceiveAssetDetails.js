/*
  ReceiveAssetDetails
  2025-11-25:
  - Added "Supported Networks" feature:
    - Implemented automatic discovery of Verus ecosystem networks for PBaaS currencies.
    - Replaced "Wallet address QR" text with an interactive "Supported networks" pill showing icons.
    - Added a detailed "Supported Networks" sheet listing compatible chains (e.g., VRSC, vDEX, CHIPS).
  - Overhauled "Create easy payment" modal:
    - Decoupled invoice QR state from main screen (main screen always shows address QR).
    - Implemented multi-step flow (Configuration -> Result).
    - Improved UI with currency segmented control and clearer conversion text.
    - Simplified result view to focus on the invoice QR.
  - Updated mapped currency pill styling to use Ethereum branding colors (#F0F0FF/#627EEA) and a double arrow icon.
  - Added modern "View on Etherscan" modal that displays the full destination URL.
  - Added mapped currency pill next to ticker (e.g., "↔ USDC (0xa0b0...eb48)") with Etherscan link.
  - Added sticky "Done" button with gradient styling matching Buy now button.
  - Simplified QR code display (removed background card).
  - Refactored address section: tappable row, fixed-width copy area to prevent layout shift on "Copied".
  - Compacted layout for better small screen compatibility.
  - Matched visual style to Wallet screen (square icons, clean layout, masked header).
  2025-11-06: Flattened layout, added coin icon header, refreshed address field, and replaced the inline invoice form with payment action sheets.
  2025-11-04: Redesigned receive experience with inline QR preview, address actions, and invoice creation controls.
*/

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, ScrollView, Clipboard, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Text, Button, TextInput, Checkbox, Portal } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import { coinsList } from '../../utils/CoinData/CoinsList';
import {
  VERUS_BRIDGE_DELEGATOR_GOERLI_CONTRACT,
  VERUS_BRIDGE_DELEGATOR_MAINNET_CONTRACT,
} from '../../utils/constants/web3Constants';
import { openUrl } from '../../utils/linking';
import { createAlert } from '../../actions/actions/alert/dispatchers/alert';
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
import { isNumber, truncateDecimal } from '../../utils/math';
import {
  sanitizeNumericInput,
  validateAmountInput,
  validateSlippageInput,
  generateReceiveInvoice,
} from '../../features/receive/receiveInvoice';
import { API_GET_FIATPRICE, API_GET_BALANCES, DLIGHT_PRIVATE } from '../../utils/constants/intervalConstants';
import { RenderSquareCoinLogo, RenderPlainCoinLogo } from '../../utils/CoinData/Graphics';
import SemiModal from '../../components/SemiModal';
import { getSupportedNetworks } from '../../utils/CoinData/SupportedNetworks';

const FLAT_INPUT_THEME = {
  roundness: 10,
  colors: {
    background: 'transparent',
    primary: Colors.primaryColor,
    text: Colors.quinaryColor,
    placeholder: Colors.verusDarkGray,
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
  const [showVerusIcon, setShowVerusIcon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ amount: null, maxSlippage: null });
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [showCopiedLabel, setShowCopiedLabel] = useState(false);
  const [explorerSheetVisible, setExplorerSheetVisible] = useState(false);
  const [supportedNetworksVisible, setSupportedNetworksVisible] = useState(false);
  
  // Invoice Modal State
  const [invoiceQr, setInvoiceQr] = useState(null);
  const [invoiceAmount, setInvoiceAmount] = useState(null);
  const [invoiceStep, setInvoiceStep] = useState('config'); // 'config' | 'result'

  const selectedSubWallet = useMemo(() => {
    if (!availableSubWallets.length) return null;
    return availableSubWallets.find((wallet) => wallet.id === selectedSubWalletId) || availableSubWallets[0];
  }, [availableSubWallets, selectedSubWalletId]);

  // Get mapped coin object (e.g., USDC on Ethereum for vUSDC.vETH)
  const mappedCoinObj = useMemo(() => {
    if (!coinObj || coinObj.mapped_to == null || coinObj.id === coinsList.VRSC?.id) {
      return null;
    }
    try {
      return CoinDirectory.getBasicCoinObj(coinObj.mapped_to);
    } catch (e) {
      console.warn('Failed to get mapped coin:', e);
      return null;
    }
  }, [coinObj]);

  // Check if mapped to Ethereum itself (not an ERC20 token)
  const mappedToEth = useMemo(() => {
    if (!coinObj || coinObj.mapped_to == null || !mappedCoinObj) return false;
    const currencyId = mappedCoinObj.currency_id?.toLowerCase();
    return (
      currencyId === VERUS_BRIDGE_DELEGATOR_GOERLI_CONTRACT?.toLowerCase() ||
      currencyId === VERUS_BRIDGE_DELEGATOR_MAINNET_CONTRACT?.toLowerCase()
    );
  }, [coinObj, mappedCoinObj]);

  // Format the mapped currency display text
  const mappedDisplayText = useMemo(() => {
    if (!mappedCoinObj) return null;
    if (mappedToEth) return 'Ethereum';
    
    const ticker = mappedCoinObj.display_ticker;
    const truncatedTicker = ticker.length > 12 ? ticker.substring(0, 12) + '…' : ticker;
    
    if (mappedCoinObj.proto === 'erc20') {
      const addr = mappedCoinObj.currency_id;
      const shortAddr = addr ? `${addr.substring(0, 6)}…${addr.substring(addr.length - 4)}` : '';
      return `${truncatedTicker} (${shortAddr})`;
    }
    return truncatedTicker;
  }, [mappedCoinObj, mappedToEth]);

  const supportedNetworks = useMemo(() => getSupportedNetworks(coinObj), [coinObj]);

  const getExplorerUrl = useCallback(() => {
    if (!mappedCoinObj || mappedCoinObj.proto !== 'erc20') return '';
    
    const baseUrl = mappedCoinObj.testnet
      ? 'https://goerli.etherscan.io/token/'
      : 'https://etherscan.io/token/';
    return baseUrl + mappedCoinObj.currency_id;
  }, [mappedCoinObj]);

  const openTokenAddressExplorer = useCallback(() => {
    if (!mappedCoinObj || mappedCoinObj.proto !== 'erc20') return;
    setExplorerSheetVisible(true);
  }, [mappedCoinObj]);

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
    if (address) {
      setQrValue(address);
      setShowVerusIcon(false);
    }
  }, [address]);

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

  const amountHasValue = useMemo(() => {
    if (!amount) return false;
    const processed = sanitizeNumericInput(amount.toString());
    if (!isNumber(processed)) return false;
    return Number(processed) > 0;
  }, [amount]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    Clipboard.setString(address);
    setShowCopiedLabel(true);
    setTimeout(() => setShowCopiedLabel(false), 2000);
  }, [address]);

  const renderAddressSection = () => (
    <View style={styles.compactSection}>
      <Text style={styles.sectionLabel}>Address</Text>
      <TouchableOpacity 
        onPress={copyAddress} 
        style={styles.addressContainerCompact}
        activeOpacity={0.7}
        accessibilityRole="button" 
        accessibilityLabel="Copy address"
      >
        <Text style={styles.addressValue} numberOfLines={1} ellipsizeMode="middle">
          {address || 'Fetching address…'}
        </Text>
        <View style={styles.copyIconContainer}>
          {showCopiedLabel ? (
            <Text style={styles.copiedLabelCompact}>Copied!</Text>
          ) : (
            <MaterialCommunityIcons name="content-copy" size={18} color={Colors.verusDarkGray} />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

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

        setInvoiceQr(qrString);
        setInvoiceAmount(processedAmount);
        setInvoiceStep('result');
        setShowVerusIcon(showVerusIcon);
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
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <View style={styles.titleRow}>
            {RenderSquareCoinLogo(coinObj.id, {}, 32, 32)}
            <Text style={styles.headerTitle}>
              {coinObj.display_name}
            </Text>
          </View>
          <View style={styles.tickerRow}>
            <Text style={styles.headerTicker}>
              {coinObj.display_ticker}
            </Text>
            {mappedCoinObj && mappedDisplayText && (
              <TouchableOpacity
                onPress={openTokenAddressExplorer}
                disabled={mappedCoinObj.proto !== 'erc20'}
                style={styles.mappedPill}
                activeOpacity={0.7}
              >
                {mappedCoinObj.proto === 'erc20' ? (
                   <MaterialCommunityIcons 
                     name="swap-horizontal" 
                     size={16} 
                     color="#627EEA" 
                     style={{ marginRight: 4 }}
                   />
                ) : (
                  <Text style={[styles.mappedPillText, { marginRight: 4 }]}>{'↔'}</Text>
                )}
                <Text style={styles.mappedPillText}>
                  {mappedDisplayText}
                </Text>
                {mappedCoinObj.proto === 'erc20' && (
                  <MaterialCommunityIcons 
                    name="open-in-new" 
                    size={12} 
                    color="#627EEA" 
                    style={styles.mappedPillIcon}
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.assetHeader}>
          <View style={styles.assetInfo} />
          {availableSubWallets.length > 1 && (
            <TouchableOpacity
              onPress={() => setSubwalletSheetVisible(true)}
              style={styles.switchChip}
              activeOpacity={0.7}
            >
              <Text style={styles.switchChipLabel}>{'Change address'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.qrContainer}>
          <QRCode
            value={qrValue || '-'}
            size={200}
            logo={undefined}
            logoSize={undefined}
            logoBackgroundColor={undefined}
            logoBorderRadius={undefined}
          />
          {supportedNetworks.length > 0 && (
            <TouchableOpacity
              style={styles.supportedNetworksPill}
              onPress={() => setSupportedNetworksVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.networkIconsContainer}>
                {supportedNetworks.slice(0, 3).map((net, index) => (
                  <View 
                    key={net.id} 
                    style={[
                      styles.networkIconWrapper, 
                      { 
                        marginLeft: index > 0 ? -12 : 0, 
                        zIndex: index + 1,
                        backgroundColor: net.theme_color || Colors.verusDarkGray
                      }
                    ]}
                  >
                     {RenderPlainCoinLogo(net.id, {}, 20, 20)}
                  </View>
                ))}
                {supportedNetworks.length > 3 && (
                  <View 
                    style={[
                      styles.networkIconWrapper,
                      styles.moreNetworksWrapper,
                      { 
                        marginLeft: -12,
                        zIndex: 10
                      }
                    ]}
                  >
                    <Text style={styles.moreNetworksText}>
                      {`+${supportedNetworks.length - 3}`}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.supportedNetworksText}>Supported chains</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.verusDarkGray} />
            </TouchableOpacity>
          )}
        </View>

        {renderAddressSection()}

        <TouchableOpacity style={styles.compactPaymentCard} onPress={() => setCreateSheetVisible(true)} activeOpacity={0.8}>
          <View style={styles.compactPaymentContent}>
            <Text style={styles.compactPaymentTitle}>{'Create payment requests'}</Text>
            <Text style={styles.compactPaymentSubtitle}>{'Request payments with easy-to-scan QR codes'}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.verusDarkGray} />
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footerContainer}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
          style={styles.doneButtonWrapper}
        >
          <Svg
            width="100%"
            height="100%"
            style={styles.doneButtonGradient}
            pointerEvents="none"
          >
            <Defs>
              <SvgLinearGradient id="doneButtonGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#00C8FF" />
                <Stop offset="1" stopColor="#0077A9" />
              </SvgLinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              rx={28}
              ry={28}
              fill="url(#doneButtonGradient)"
            />
          </Svg>
          <View style={styles.doneButtonContent}>
            <Text style={styles.doneButtonLabel}>{'Done'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading && <AnimatedActivityIndicatorBox />}

      <Portal>
        {infoSheetVisible && (
          <SemiModal
            animationType="slide"
            transparent={true}
            visible={true}
            onRequestClose={() => setInfoSheetVisible(false)}
            flexHeight={0.01}
            contentContainerStyle={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              flex: 0,
              alignSelf: 'flex-end',
              width: '100%',
              maxHeight: '70%',
            }}
          >
            <View>
              <View style={styles.sheetHeader}>
                <Button onPress={() => setInfoSheetVisible(false)} textColor={Colors.primaryColor}>{'Close'}</Button>
                <Text style={styles.sheetTitle}>{'Create easy payment'}</Text>
                <View style={styles.sheetHeaderSpacer} />
              </View>
              <View style={styles.sheetBody}>
                <Text style={styles.infoParagraph}>
                  {'Set an amount and we generate a VerusPay invoice your contact can scan or open directly in their wallet.'}
                </Text>
                <Text style={styles.infoParagraph}>
                  {'Invoices capture the destination, currency, and optional conversion rules so the sender sees exactly what to pay.'}
                </Text>
                <Button
                  mode="contained"
                  onPress={() => setInfoSheetVisible(false)}
                  style={styles.sheetPrimaryButton}
                  contentStyle={styles.sheetPrimaryButtonContent}
                  labelStyle={styles.sheetPrimaryButtonLabel}
                >
                  {'Got it'}
                </Button>
              </View>
            </View>
          </SemiModal>
        )}

        {createSheetVisible && (
          <SemiModal
            animationType="slide"
            transparent={true}
            visible={true}
            onRequestClose={() => {
              setCreateSheetVisible(false);
              setInvoiceStep('config');
              setInvoiceQr(null);
            }}
            flexHeight={0.01}
            contentContainerStyle={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              flex: 0,
              alignSelf: 'flex-end',
              width: '100%',
              maxHeight: '90%',
            }}
          >
            <View>
              <View style={styles.sheetHeader}>
                <Button 
                  onPress={() => {
                    setCreateSheetVisible(false);
                    setInvoiceStep('config');
                    setInvoiceQr(null);
                  }} 
                  textColor={Colors.primaryColor}
                >
                  {'Close'}
                </Button>
                <Text style={styles.sheetTitle}>
                  {invoiceStep === 'config' ? 'Create easy payment' : 'Payment invoice'}
                </Text>
                <View style={styles.sheetHeaderSpacer} />
              </View>
              
              <ScrollView
                contentContainerStyle={styles.sheetBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {invoiceStep === 'config' ? (
                  <>
                    <Text style={styles.sheetSubtitle}>
                      {'Enter an amount to generate a VerusPay invoice. Sender can scan to pay instantly.'}
                    </Text>

                    <View style={styles.sheetFieldGroup}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionLabel}>{'Amount'}</Text>
                        {amountPreview && <Text style={styles.sectionHint}>{amountPreview}</Text>}
                      </View>
                      
                      <View style={styles.amountRow}>
                        <View style={styles.amountInputContainer}>
                          <TextInput
                            mode="flat"
                            label={amountFiat ? displayCurrency : coinObj.display_ticker}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="decimal-pad"
                            error={errors.amount != null}
                            style={styles.amountInput}
                            theme={FLAT_INPUT_THEME}
                            underlineColor={Colors.tertiaryColor}
                            activeUnderlineColor={Colors.primaryColor}
                          />
                          {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
                        </View>
                      </View>
                      
                      <View style={styles.currencyToggleContainer}>
                        <TouchableOpacity 
                          style={[styles.currencyToggleBtn, !amountFiat && styles.currencyToggleBtnActive]} 
                          onPress={() => setAmountFiat(false)}
                        >
                          <Text style={[styles.currencyToggleText, !amountFiat && styles.currencyToggleTextActive]}>
                            {coinObj.display_ticker}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.currencyToggleBtn, amountFiat && styles.currencyToggleBtnActive]} 
                          onPress={() => setAmountFiat(true)}
                        >
                          <Text style={[styles.currencyToggleText, amountFiat && styles.currencyToggleTextActive]}>
                            {displayCurrency}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {conversionEligible && (
                      <View style={styles.sheetFieldGroup}>
                        <TouchableOpacity 
                          style={styles.checkboxRow} 
                          activeOpacity={0.8}
                          onPress={() => setAllowConversion(!allowConversion)}
                        >
                          <View style={{flex: 1, paddingRight: 12}}>
                            <Text style={styles.checkboxLabel}>{'Allow payment in other currencies'}</Text>
                            <Text style={styles.checkboxSubtitle}>
                              {`Sender can pay with PBaaS currencies, auto-converting to ${coinObj.display_ticker}.`}
                            </Text>
                          </View>
                          <Checkbox.Android
                            status={allowConversion ? 'checked' : 'unchecked'}
                            onPress={() => setAllowConversion(!allowConversion)}
                            color={Colors.primaryColor}
                            uncheckedColor={Colors.tertiaryColor}
                          />
                        </TouchableOpacity>
                        
                        {generalSettings.allowSettingVerusPaySlippage && allowConversion && (
                          <View style={styles.slippageRow}>
                            <Text style={styles.sectionLabel}>{'Max slippage (%)'}</Text>
                            <TextInput
                              mode="flat"
                              value={maxSlippage}
                              onChangeText={setMaxSlippage}
                              keyboardType="decimal-pad"
                              error={errors.maxSlippage != null}
                              style={styles.amountInput}
                              theme={FLAT_INPUT_THEME}
                              underlineColor={Colors.tertiaryColor}
                              activeUnderlineColor={Colors.primaryColor}
                            />
                            {errors.maxSlippage && <Text style={styles.errorText}>{errors.maxSlippage}</Text>}
                          </View>
                        )}
                      </View>
                    )}

                    <Button
                      mode="contained"
                      onPress={handleGenerateInvoice}
                      disabled={loading || !address || !amountHasValue}
                      style={styles.sheetPrimaryButton}
                      contentStyle={styles.sheetPrimaryButtonContent}
                      labelStyle={styles.sheetPrimaryButtonLabel}
                    >
                      {loading ? 'Generating…' : 'Generate invoice'}
                    </Button>
                  </>
                ) : (
                  <View style={styles.resultContainer}>
                    <View style={styles.qrContainer}>
                      <QRCode
                        value={invoiceQr || '-'}
                        size={220}
                        logo={showVerusIcon ? require('../../images/customIcons/Verus.png') : undefined}
                        logoSize={showVerusIcon ? 48 : undefined}
                        logoBackgroundColor={showVerusIcon ? 'white' : undefined}
                        logoBorderRadius={showVerusIcon ? 80 : undefined}
                      />
                    </View>
                    
                    <Text style={styles.resultAmountText}>
                      {`Scan to pay ${amount} ${amountFiat ? displayCurrency : coinObj.display_ticker}`}
                    </Text>
                    {amountFiat && amountPreview && (
                      <Text style={styles.resultAmountSubText}>{amountPreview}</Text>
                    )}

                    <View style={styles.resultActions}>
                      <Button
                        mode="contained"
                        onPress={() => {
                          setCreateSheetVisible(false);
                          setInvoiceStep('config');
                          setInvoiceQr(null);
                        }}
                        style={styles.sheetPrimaryButton}
                        contentStyle={styles.sheetPrimaryButtonContent}
                        labelStyle={styles.sheetPrimaryButtonLabel}
                      >
                        {'Done'}
                      </Button>
                      
                      <Button
                        mode="text"
                        onPress={() => {
                          setInvoiceStep('config');
                          setInvoiceQr(null);
                        }}
                        textColor={Colors.primaryColor}
                        contentStyle={styles.sheetTextButtonContent}
                        labelStyle={styles.sheetTextButtonLabel}
                        style={{marginTop: 8}}
                      >
                        {'Create another invoice'}
                      </Button>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </SemiModal>
        )}

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

        {explorerSheetVisible && mappedCoinObj && (
          <SemiModal
            animationType="slide"
            transparent={true}
            visible={true}
            onRequestClose={() => setExplorerSheetVisible(false)}
            flexHeight={0.01}
            contentContainerStyle={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              flex: 0,
              alignSelf: 'flex-end',
              width: '100%',
            }}
          >
            <View>
              <View style={styles.sheetHeader}>
                <Button onPress={() => setExplorerSheetVisible(false)} textColor={Colors.primaryColor}>{'Close'}</Button>
                <Text style={styles.sheetTitle}>{'View on Etherscan'}</Text>
                <View style={styles.sheetHeaderSpacer} />
              </View>
              <View style={styles.sheetBody}>
                 <Text style={styles.infoParagraph}>
                  {'You are about to visit the following URL:'}
                </Text>
                <View style={styles.urlBox}>
                    <Text style={styles.urlText}>{getExplorerUrl()}</Text>
                </View>
                <Button
                  mode="contained"
                  onPress={() => {
                      setExplorerSheetVisible(false);
                      openUrl(getExplorerUrl());
                  }}
                  style={styles.sheetPrimaryButton}
                  contentStyle={styles.sheetPrimaryButtonContent}
                  labelStyle={styles.sheetPrimaryButtonLabel}
                >
                  {'Open browser'}
                </Button>
              </View>
            </View>
          </SemiModal>
        )}

        {supportedNetworksVisible && (
          <SemiModal
            animationType="slide"
            transparent={true}
            visible={true}
            onRequestClose={() => setSupportedNetworksVisible(false)}
            flexHeight={0.01}
            contentContainerStyle={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              flex: 0,
              alignSelf: 'flex-end',
              width: '100%',
              maxHeight: '70%',
            }}
          >
            <View>
              <View style={styles.sheetHeader}>
                <Button onPress={() => setSupportedNetworksVisible(false)} textColor={Colors.primaryColor}>{'Close'}</Button>
                <Text style={styles.sheetTitle}>{'Supported chains'}</Text>
                <View style={styles.sheetHeaderSpacer} />
              </View>
              <View style={styles.sheetBody}>
                <Text style={styles.infoParagraph}>
                  {'This address supports all currencies on all chains in the Verus ecosystem.'}
                </Text>
                <View style={styles.networksListContainer}>
                  {supportedNetworks.map((net) => (
                    <View key={net.id} style={styles.networkListItem}>
                      {RenderSquareCoinLogo(net.id, {}, 32, 32)}
                      <View style={styles.networkListItemTextContainer}>
                        <Text style={styles.networkListItemTitle}>{net.display_name}</Text>
                        <Text style={styles.networkListItemSubtitle}>{net.display_ticker}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Button
                  mode="contained"
                  onPress={() => setSupportedNetworksVisible(false)}
                  style={styles.sheetPrimaryButton}
                  contentStyle={styles.sheetPrimaryButtonContent}
                  labelStyle={styles.sheetPrimaryButtonLabel}
                >
                  {'Got it'}
                </Button>
              </View>
            </View>
          </SemiModal>
        )}
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 20,
  },
  headerContainer: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    marginLeft: 12,
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 44, // 32 (icon width) + 12 (margin left)
    flexWrap: 'wrap',
  },
  headerTicker: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  mappedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0FF', // Ethereum light purple background
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  mappedPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#627EEA', // Ethereum logo purple-blue
  },
  mappedPillIcon: {
    marginLeft: 4,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  assetInfo: {
    flex: 1,
    paddingRight: 16,
  },
  switchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.tertiaryColor,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  switchChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.quinaryColor,
    letterSpacing: 0.2,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrLabel: {
    fontSize: 13,
    color: Colors.verusDarkGray,
    marginTop: 16,
    fontWeight: '500',
  },
  qrActionButton: {
    marginTop: 8,
  },
  compactSection: {
    width: '100%',
    marginBottom: 16,
  },
  addressContainerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginTop: 8,
  },
  addressValue: {
    flex: 1,
    fontSize: 14,
    color: Colors.quinaryColor,
    fontWeight: '500',
    marginRight: 12,
  },
  copyIconContainer: {
    width: 56,
    height: 20,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  copiedLabelCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.verusGreenColor,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.quinaryColor,
  },
  compactPaymentCard: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  compactPaymentContent: {
    flex: 1,
    paddingRight: 12,
  },
  compactPaymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.quinaryColor,
    marginBottom: 2,
  },
  compactPaymentSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666666',
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: 'white',
  },
  doneButtonWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    height: 56,
  },
  doneButtonGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  doneButtonContent: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 0.5,
    textTransform: 'none',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  sheetHeaderSpacer: {
    width: 64,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.quinaryColor,
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  infoParagraph: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    marginBottom: 16,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 20,
  },
  sheetFieldGroup: {
    marginBottom: 24,
  },
  sheetPrimaryButton: {
    borderRadius: 24,
    backgroundColor: Colors.primaryColor,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    marginTop: 4,
  },
  sheetPrimaryButtonContent: {
    height: 48,
  },
  sheetPrimaryButtonLabel: {
    color: Colors.secondaryColor,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0,
    textTransform: 'none',
  },
  sheetQrPreview: {
    marginTop: 28,
    alignItems: 'center',
  },
  sheetTextButtonContent: {
    height: 36,
  },
  sheetTextButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    textTransform: 'none',
  },
  urlBox: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  urlText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    fontFamily: 'Courier', 
  },
  currencyToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    height: 40,
    marginBottom: 16,
  },
  currencyToggleBtn: {
    flex: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyToggleBtnActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  currencyToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  currencyToggleTextActive: {
    color: Colors.primaryColor,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.quinaryColor,
    marginBottom: 4,
  },
  checkboxSubtitle: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  resultContainer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  resultAmountText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.quinaryColor,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 4,
  },
  resultAmountSubText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  resultActions: {
    width: '100%',
    marginTop: 8,
  },
  supportedNetworksPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 8,
    marginTop: 16,
  },
  networkIconsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  networkIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  moreNetworksWrapper: {
    backgroundColor: Colors.verusDarkGray,
  },
  moreNetworksText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  supportedNetworksText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
    marginRight: 4,
  },
  networksListContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  networkListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  networkListItemTextContainer: {
    marginLeft: 12,
  },
  networkListItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.quinaryColor,
  },
  networkListItemSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
});

export default ReceiveAssetDetails;
