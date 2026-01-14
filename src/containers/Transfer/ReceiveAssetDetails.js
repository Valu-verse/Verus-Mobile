/*
  ReceiveAssetDetails
  2024-12-15:
  - Fixed crash when changing address: removed reference to non-existent setShowingInvoice state.
  - For VerusID addresses: display VerusID name as main field with i-address shown separately below.
  - Moved "Change address" to header icon (tune-vertical) in top right corner.
  2025-11-27:
  - Updated "Easy to share payment request" card to dynamically change based on coin capabilities:
    - For coins supporting invoices (conversionEligible): Show "Easy to share payment request" with image.
    - For others: Show "Create payment request" without image.
  - Updated Payment Request Result modal:
    - For coins supporting invoices: Show "Share payment link".
    - For others: Show "Save QR to camera roll" which saves the code to camera roll.
    - Added success state ("QR image saved" with checkmark) after saving.
  2025-11-26:
  - Updated payment request flow to clear amount and subject fields when closing the modal or starting a new payment.
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
  2026-01-12: Standardized all SemiModal sheet headers to use the shared top-right X (no blue "Close" text).
*/

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { View, ScrollView, Clipboard, TouchableOpacity, StyleSheet, Dimensions, Platform, Share, ImageBackground, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Text, Button, TextInput, Checkbox, Portal } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import RNFS from "react-native-fs";
import NumericKeypad from '../../components/Keypad/NumericKeypad';
import GradientButton from '../../components/GradientButton';
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

// Get the locale decimal separator (e.g., "." for en-US, "," for de-DE)
const getDecimalSeparator = () => {
  const n = 1.1;
  return n.toLocaleString().replace(/1/g, '');
};

const ReceiveAssetDetails = () => {
  const { height, width } = Dimensions.get('window');
  const isSmall = height <= 667 || width <= 375;
  const decimalSeparator = useMemo(() => getDecimalSeparator(), []);

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
  const [allowConversion, setAllowConversion] = useState(true);
  const [maxSlippage, setMaxSlippage] = useState('0.5');
  const [qrValue, setQrValue] = useState('-');
  const [showVerusIcon, setShowVerusIcon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ amount: null, maxSlippage: null });
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [showCopiedLabel, setShowCopiedLabel] = useState(false);
  const [showCopiedIAddress, setShowCopiedIAddress] = useState(false);
  const [explorerSheetVisible, setExplorerSheetVisible] = useState(false);
  const [supportedNetworksVisible, setSupportedNetworksVisible] = useState(false);
  
  // Invoice Modal State
  const [invoiceQr, setInvoiceQr] = useState(null);
  const [invoiceAmount, setInvoiceAmount] = useState(null);
  const [invoiceSubject, setInvoiceSubject] = useState('');
  const [invoiceStep, setInvoiceStep] = useState('amount'); // 'amount' | 'subject' | 'settings' | 'result'
  const [subjectFocused, setSubjectFocused] = useState(false);
  const [qrSaved, setQrSaved] = useState(false);
  
  const subjectInputRef = useRef(null);
  const qrCodeRef = useRef(null);

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
      headerRight: () =>
        availableSubWallets.length > 1 ? (
          <TouchableOpacity
            onPress={() => setSubwalletSheetVisible(true)}
            style={styles.headerIconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="tune-vertical" size={24} color={Colors.verusDarkGray} />
          </TouchableOpacity>
        ) : null,
      headerBackTitle: 'Back',
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: 'white',
        elevation: 0,
        shadowOpacity: 0,
      },
    });
  }, [navigation, availableSubWallets.length]);

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
  const keyboardState = useSelector((state) => state.keyboard);

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

  // Detect if this is a VerusID (name ends with @ or differs from the raw address)
  const isVerusId = useMemo(() => {
    if (!selectedSubWallet || !selectedSubWallet.name) return false;
    const name = selectedSubWallet.name;
    // VerusID names end with @
    return name.endsWith('@');
  }, [selectedSubWallet]);

  const verusIdName = isVerusId ? selectedSubWallet.name : null;

  const copyAddress = useCallback(() => {
    if (!address) return;
    Clipboard.setString(address);
    if (isVerusId) {
      setShowCopiedIAddress(true);
      setTimeout(() => setShowCopiedIAddress(false), 2000);
    } else {
      setShowCopiedLabel(true);
      setTimeout(() => setShowCopiedLabel(false), 2000);
    }
  }, [address, isVerusId]);

  const copyVerusIdName = useCallback(() => {
    if (!verusIdName) return;
    Clipboard.setString(verusIdName);
    setShowCopiedLabel(true);
    setTimeout(() => setShowCopiedLabel(false), 2000);
  }, [verusIdName]);

  const renderAddressSection = () => {
    if (isVerusId && verusIdName) {
      // VerusID: Show VerusID name as main field, i-address below
      return (
        <View style={styles.compactSection}>
          <Text style={styles.sectionLabel}>VerusID</Text>
          <TouchableOpacity 
            onPress={copyVerusIdName} 
            style={styles.addressContainerCompact}
            activeOpacity={0.7}
            accessibilityRole="button" 
            accessibilityLabel="Copy VerusID"
          >
            <Text style={styles.addressValue} numberOfLines={1} ellipsizeMode="middle">
              {verusIdName}
            </Text>
            <View style={styles.copyIconContainer}>
              {showCopiedLabel ? (
                <Text style={styles.copiedLabelCompact}>Copied!</Text>
              ) : (
                <MaterialCommunityIcons name="content-copy" size={18} color={Colors.verusDarkGray} />
              )}
            </View>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>i-Address</Text>
          <TouchableOpacity 
            onPress={copyAddress} 
            style={styles.addressContainerCompact}
            activeOpacity={0.7}
            accessibilityRole="button" 
            accessibilityLabel="Copy i-address"
          >
            <Text style={styles.addressValue} numberOfLines={1} ellipsizeMode="middle">
              {address || 'Fetching address…'}
            </Text>
            <View style={styles.copyIconContainer}>
              {showCopiedIAddress ? (
                <Text style={styles.copiedLabelCompact}>Copied!</Text>
              ) : (
                <MaterialCommunityIcons name="content-copy" size={18} color={Colors.verusDarkGray} />
              )}
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    // Regular address
    return (
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
  };

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

  const handleShare = useCallback(async () => {
    if (!invoiceQr) return;

    try {
      const currency = amountFiat ? displayCurrency : coinObj.display_ticker;
      const message = `Please could you pay me ${invoiceAmount} ${currency}${invoiceSubject ? ` for '${invoiceSubject}'` : ''} with ${invoiceQr}`;

      await Share.share({
        message,
      });
    } catch (error) {
      console.error(error.message);
    }
  }, [invoiceQr, address, invoiceAmount, amountFiat, displayCurrency, coinObj]);

  const saveQRToDisk = useCallback(() => {
    if (!qrCodeRef.current) return;

    const fileName = `VerusPayQR_${Date.now()}`;
    
    qrCodeRef.current.toDataURL((data) => {
      RNFS.writeFile(RNFS.CachesDirectoryPath + `/${fileName}.png`, data, 'base64')
        .then(() => {
          return CameraRoll.save(RNFS.CachesDirectoryPath + `/${fileName}.png`, { type: 'photo' });
        })
        .then(() => {
          return RNFS.unlink(RNFS.CachesDirectoryPath + `/${fileName}.png`);
        })
        .then(() => {
          setQrSaved(true);
        })
        .catch(e => {
          console.warn(e);
          createAlert("Error", e.message || "Failed to save QR code");
        });
    });
  }, [qrCodeRef]);

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

        <TouchableOpacity 
          style={styles.compactPaymentCard} 
          onPress={() => setCreateSheetVisible(true)} 
          activeOpacity={0.8}
        >
            <View style={styles.paymentCardContent}>
              <Text style={styles.compactPaymentTitle}>
                {conversionEligible ? 'Easy to share payment request' : 'Create payment request'}
              </Text>
            </View>
            {conversionEligible && (
              <View style={styles.paymentImageContainer}>
                <Image
                  source={require('../../images/customIcons/requestImage.png')}
                  style={styles.paymentRequestImage}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={{paddingRight: 16}}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.verusDarkGray} />
            </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footerContainer}>
        <GradientButton
          onPress={() => navigation.navigate('Home')}
        >
          {'Done'}
        </GradientButton>
      </View>

      {loading && <AnimatedActivityIndicatorBox />}

      <Portal>
        {infoSheetVisible && (
          <SemiModal
            animationType="slide"
            transparent={true}
            visible={true}
            onRequestClose={() => setInfoSheetVisible(false)}
            title="Create easy payment"
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
              <View style={styles.sheetBody}>
                <Text style={styles.infoParagraph}>
                  {'Set an amount and we generate a VerusPay invoice your contact can scan or open directly in their wallet.'}
                </Text>
                <Text style={styles.infoParagraph}>
                  {'Invoices capture the destination, currency, and optional conversion rules so the sender sees exactly what to pay.'}
                </Text>
                <GradientButton
                  onPress={() => setInfoSheetVisible(false)}
                >
                  {'Got it'}
                </GradientButton>
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
              setInvoiceStep('amount');
              setInvoiceQr(null);
              setAmount('');
              setInvoiceSubject('');
              setQrSaved(false);
            }}
            title="Payment request"
            flexHeight={0.01}
            contentContainerStyle={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              flex: 0,
              alignSelf: 'flex-end',
              width: '100%',
              maxHeight: '90%',
              backgroundColor: 'white',
              // When keyboard is active on Subject or Settings step, add keyboard height to push content up
              ...((invoiceStep === 'subject' || invoiceStep === 'settings') && Platform.OS === 'ios' && keyboardState.active
                ? { marginBottom: keyboardState.height }
                : {}),
            }}
          >
            <View style={{backgroundColor: 'white'}}>
              <View>
              {invoiceStep === 'amount' ? (
                <View style={{justifyContent: 'space-between'}}>
                  <View style={styles.amountStepContainer}>
                    <Text style={styles.amountStepTitle}>What's the amount?</Text>
                    
                    <View style={styles.amountInputRow}>
                      <Text style={styles.amountValueText}>
                        {amount ? amount.replace('.', decimalSeparator) : `0${decimalSeparator}00`}
                      </Text>
                      <Text style={styles.amountCurrencySymbol}>
                        {amountFiat ? displayCurrency : coinObj.display_ticker}
                      </Text>
                    </View>
                    
                    <View style={styles.amountPreviewContainer}>
                      {amountPreview && (
                        <Text style={styles.amountPreviewText}>{amountPreview}</Text>
                      )}
                    </View>
                    
                    <TouchableOpacity 
                        style={styles.currencySwitchButton}
                        onPress={() => {
                            const price = priceMap ? priceMap[displayCurrency] : null;
                            if (amount && price && Number(price) > 0) {
                                const currentVal = Number(sanitizeNumericInput(amount));
                                let newAmount;
                                if (amountFiat) {
                                    // Fiat -> Crypto
                                    newAmount = truncateDecimal(currentVal / Number(price), 8);
                                } else {
                                    // Crypto -> Fiat
                                    newAmount = truncateDecimal(currentVal * Number(price), 2);
                                }
                                setAmount(newAmount.toString());
                            }
                            setAmountFiat(!amountFiat);
                        }}
                    >
                         <MaterialCommunityIcons name="swap-vertical" size={16} color="#666" />
                         <Text style={styles.currencySwitchText}>
                            {amountFiat ? `Switch to ${coinObj.display_ticker}` : `Switch to ${displayCurrency}`}
                         </Text>
                    </TouchableOpacity>
                  </View>

                  <View>
                      <View style={styles.keypadContainer}>
                        <NumericKeypad
                            value={amount}
                            onChange={setAmount}
                            decimalPlaces={amountFiat ? 2 : 8}
                            keyHeight={isSmall ? 40 : 48}
                            fontSize={isSmall ? 22 : 26}
                            keyBackground="transparent"
                            rowSpacing={4}
                        />
                      </View>
                      <View style={styles.amountStepFooter}>
                          <GradientButton
                            onPress={() => {
                                if (conversionEligible) {
                                    setInvoiceStep('subject');
                                } else {
                                    handleGenerateInvoice();
                                }
                            }}
                            disabled={!amountHasValue}
                          >
                            {'Next'}
                          </GradientButton>
                      </View>
                  </View>
                </View>
              ) : invoiceStep === 'subject' ? (
                  <View style={{minHeight: 220}}>
                    <View style={{paddingHorizontal: 24, paddingTop: 8}}>
                      <Text style={styles.amountStepTitle}>
                        {'What is it for?'}
                      </Text>
                      <Text style={styles.sheetSubtitle}>
                        {'Optional'}
                      </Text>
                      <TextInput
                        ref={(ref) => {
                          subjectInputRef.current = ref;
                          if (ref && invoiceStep === 'subject') {
                             setTimeout(() => ref.focus(), 100);
                          }
                        }}
                        placeholder="e.g. Dinner"
                        value={invoiceSubject}
                        onChangeText={setInvoiceSubject}
                        mode="outlined"
                        onFocus={() => setSubjectFocused(true)}
                        onBlur={() => setSubjectFocused(false)}
                        style={{
                          backgroundColor: '#FAFAFA',
                          fontSize: 16,
                          height: 56,
                        }}
                        outlineStyle={{
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: subjectFocused ? Colors.primaryColor : '#E0E0E0',
                        }}
                        theme={{
                          colors: {
                            primary: Colors.primaryColor, 
                            text: '#1A1A1A',
                            placeholder: '#999',
                            background: '#FAFAFA'
                          },
                          roundness: 12
                        }}
                        returnKeyType="next"
                        onSubmitEditing={() => setInvoiceStep('settings')}
                      />
                    </View>
                    <View style={{paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32}}>
                        <GradientButton
                            onPress={() => setInvoiceStep('settings')}
                        >
                            {'Next'}
                        </GradientButton>
                    </View>
                  </View>
              ) : invoiceStep === 'settings' ? (
                  <View style={{paddingHorizontal: 24}}>
                    <View style={{marginTop: 8, marginBottom: 24}}>
                        <Text style={styles.amountStepTitle}>
                            {'Allow conversions'}
                        </Text>
                        <Text style={styles.sheetSubtitle}>
                            {`Sender can pay with currencies that can auto-convert to ${coinObj.display_ticker}. Easy for them, easy for you.`}
                        </Text>
                    </View>
                
                    <View style={styles.sheetFieldGroup}>
                        <TouchableOpacity 
                          style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: '#FAFAFA',
                              padding: 16,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: '#F0F0F0'
                          }}
                          activeOpacity={0.8}
                          onPress={() => setAllowConversion(!allowConversion)}
                        >
                          <View style={{flex: 1, paddingRight: 12}}>
                            <Text style={{fontSize: 16, fontWeight: '600', color: Colors.quinaryColor}}>
                                {'Enable conversions'}
                            </Text>
                            <Text style={{fontSize: 12, color: '#888', marginTop: 2}}>
                                {'Max. slippage: 0.5%'}
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
                          <View style={{marginTop: 16}}>
                            <Text style={{...styles.sectionLabel, marginBottom: 8}}>{'Max slippage (%)'}</Text>
                            <TextInput
                              mode="outlined"
                              value={maxSlippage}
                              onChangeText={setMaxSlippage}
                              keyboardType="decimal-pad"
                              error={errors.maxSlippage != null}
                              style={{backgroundColor: 'white', height: 44}}
                              theme={{colors: {primary: Colors.primaryColor, background: 'white'}}}
                              outlineColor={Colors.tertiaryColor}
                              activeOutlineColor={Colors.primaryColor}
                            />
                            {errors.maxSlippage && <Text style={{color: 'red', fontSize: 12, marginTop: 4}}>{errors.maxSlippage}</Text>}
                          </View>
                        )}
                    </View>

                    <View style={{paddingBottom: 32, paddingTop: 16}}>
                      <GradientButton
                        onPress={handleGenerateInvoice}
                        disabled={loading}
                      >
                        {loading ? 'Generating…' : 'Create payment link'}
                      </GradientButton>
                    </View>
                  </View>
              ) : (
                  <View style={styles.resultContainer}>
                    <View style={styles.qrContainer}>
                      <QRCode
                        value={invoiceQr || '-'}
                        size={220}
                        getRef={(c) => (qrCodeRef.current = c)}
                        logo={showVerusIcon ? require('../../images/customIcons/Verus.png') : undefined}
                        logoSize={showVerusIcon ? 48 : undefined}
                        logoBackgroundColor={showVerusIcon ? 'white' : undefined}
                        logoBorderRadius={showVerusIcon ? 80 : undefined}
                      />
                    </View>
                    
                    <Text style={styles.resultAmountText}>
                      {`Scan to pay ${invoiceAmount} ${amountFiat ? displayCurrency : coinObj.display_ticker} to ${(address || '').length > 10 ? `${(address || '').substring(0, 5)}...${(address || '').substring((address || '').length - 5)}` : (address || '')}`}
                    </Text>
                    
                    <View style={styles.resultActions}>
                      <View style={{width: '80%', alignSelf: 'center', marginBottom: 12}}>
                        <GradientButton
                          onPress={conversionEligible ? handleShare : (qrSaved ? () => {} : saveQRToDisk)}
                          contentStyle={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}
                          disabled={!conversionEligible && qrSaved}
                          style={(!conversionEligible && qrSaved) ? { opacity: 1 } : {}}
                          topColor={(!conversionEligible && qrSaved) ? Colors.verusGreenColor : undefined}
                          bottomColor={(!conversionEligible && qrSaved) ? Colors.verusGreenColor : undefined}
                        >
                          <MaterialCommunityIcons 
                            name={conversionEligible ? "share-variant" : (qrSaved ? "check" : "content-save")} 
                            size={20} 
                            color="white" 
                            style={{marginRight: 8}} 
                          />
                        <Text style={{
                          fontSize: 16, 
                          fontWeight: '700', 
                          color: 'white',
                          textShadowColor: 'rgba(0, 0, 0, 0.3)',
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 4,
                        }}>
                          {conversionEligible ? 'Share payment link' : (qrSaved ? 'QR image saved' : 'Save QR to camera roll')}
                        </Text>
                        </GradientButton>
                      </View>
                      
                      <View style={{width: '80%', alignSelf: 'center'}}>
                        <GradientButton
                          onPress={() => {
                            setInvoiceStep('amount');
                            setInvoiceQr(null);
                            setInvoiceSubject('');
                            setAmount('');
                            setQrSaved(false);
                          }}
                          mode="outlined"
                        >
                          {'New payment request'}
                        </GradientButton>
                      </View>
                    </View>
                  </View>
              )}
              </View>
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
            title="View on Etherscan"
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
              <View style={styles.sheetBody}>
                 <Text style={styles.infoParagraph}>
                  {'You are about to visit the following URL:'}
                </Text>
                <View style={styles.urlBox}>
                    <Text style={styles.urlText}>{getExplorerUrl()}</Text>
                </View>
                <GradientButton
                  onPress={() => {
                      setExplorerSheetVisible(false);
                      openUrl(getExplorerUrl());
                  }}
                >
                  {'Open browser'}
                </GradientButton>
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
            title="Supported chains"
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
                <GradientButton
                  onPress={() => setSupportedNetworksVisible(false)}
                >
                  {'Got it'}
                </GradientButton>
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
  headerIconButton: {
    padding: 8,
    marginRight: 4,
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
    overflow: 'hidden',
    marginBottom: 0,
    height: 65,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  paymentCardContent: {
    paddingLeft: 20,
    justifyContent: 'center',
    flex: 1,
  },
  compactPaymentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.quinaryColor,
  },
  paymentImageContainer: {
    height: '100%',
    width: 160,
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    marginBottom: -10,
  },
  paymentRequestImage: {
    width: 160,
    height: 70,
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: 'white',
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
    paddingBottom: 32,
  },
  resultAmountText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
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
  // Amount step styles (inspired by modern payment apps)
  amountStepContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  amountStepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.quinaryColor,
    marginBottom: 16,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amountCurrencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666', // Neutral gray instead of primary color
    marginLeft: 8, // Margin left since it's now on the right
  },
  amountValueText: {
    fontSize: 48, // Slightly larger for emphasis
    fontWeight: '400',
    color: Colors.quinaryColor, // Dark color for value
  },
  amountPreviewContainer: {
    height: 24, // Fixed height to reserve space for preview text
    justifyContent: 'center',
    marginTop: 8,
  },
  amountPreviewText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
  },
  currencySwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  currencySwitchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444', // Neutral dark gray
    marginLeft: 6,
  },
  keypadContainer: {
    paddingBottom: 8,
  },
  amountStepFooter: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
});

export default ReceiveAssetDetails;
