/*
  ReceiveAssetDetails
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
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import SemiModal from '../../components/SemiModal';

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
  const [showingInvoice, setShowingInvoice] = useState(false);
  const [showVerusIcon, setShowVerusIcon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ amount: null, maxSlippage: null });
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [showCopiedLabel, setShowCopiedLabel] = useState(false);

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

  const amountHasValue = useMemo(() => {
    if (!amount) return false;
    const processed = sanitizeNumericInput(amount.toString());
    if (!isNumber(processed)) return false;
    return Number(processed) > 0;
  }, [amount]);

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
    setShowCopiedLabel(true);
    setTimeout(() => setShowCopiedLabel(false), 2000);
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
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.assetHeader}>
          <View style={styles.assetInfo}>
            <View style={styles.assetTitleRow}>
              <View style={styles.assetIconWrapper}>
                {RenderSquareCoinLogo(coinObj.id, {}, 32, 32)}
              </View>
              <Text style={styles.assetName}>{coinObj.display_name}</Text>
            </View>
          </View>
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

        <View style={styles.qrSection}>
          <QRCode
            value={qrValue || '-'}
            size={232}
            logo={showVerusIcon ? require('../../images/customIcons/Verus.png') : undefined}
            logoSize={showVerusIcon ? 56 : undefined}
            logoBackgroundColor={showVerusIcon ? 'white' : undefined}
            logoBorderRadius={showVerusIcon ? 100 : undefined}
          />
          <Text style={styles.qrLabel}>
            {showingInvoice ? 'VerusPay invoice QR' : 'Wallet address QR'}
          </Text>
          {showingInvoice && (
            <Button
              style={styles.qrActionButton}
              textColor={Colors.primaryColor}
              onPress={resetToAddressQr}
            >
              {'Show address QR'}
            </Button>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.addressHeaderRow}>
            <Text style={styles.sectionLabel}>Address</Text>
            {showCopiedLabel && <Text style={styles.copiedLabel}>Copied</Text>}
          </View>
          <View style={styles.addressContainer}>
            <Text style={styles.addressValue} selectable>
              {address || 'Fetching address…'}
            </Text>
            <TouchableOpacity onPress={copyAddress} style={styles.copyIconButton} accessibilityRole="button" accessibilityLabel="Copy address">
              <MaterialCommunityIcons name="content-copy" size={20} color={Colors.verusDarkGray} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.paymentCard}>
          <View style={styles.paymentCardContent}>
            <Text style={styles.paymentCardTitle}>{'Create easy payment'}</Text>
            <Text style={styles.paymentCardSubtitle}>{'Request payments with VerusPay invoices'}</Text>
          </View>
          <View style={styles.paymentCardButtons}>
            <Button
              mode="contained"
              onPress={() => setCreateSheetVisible(true)}
              style={styles.createButton}
              contentStyle={styles.createButtonContent}
              labelStyle={styles.createButtonLabel}
            >
              {'Create'}
            </Button>
            <TouchableOpacity
              onPress={() => setInfoSheetVisible(true)}
              activeOpacity={0.7}
              style={styles.howItWorksLink}
              accessibilityRole="button"
              accessibilityLabel="How it works"
            >
              <Text style={styles.howItWorksLinkText}>{'How it works'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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
            onRequestClose={() => setCreateSheetVisible(false)}
            flexHeight={0.01}
            contentContainerStyle={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              flex: 0,
              alignSelf: 'flex-end',
              width: '100%',
              maxHeight: '80%',
            }}
          >
            <View>
              <View style={styles.sheetHeader}>
                <Button onPress={() => setCreateSheetVisible(false)} textColor={Colors.primaryColor}>{'Close'}</Button>
                <Text style={styles.sheetTitle}>{'Create easy payment'}</Text>
                <View style={styles.sheetHeaderSpacer} />
              </View>
              <ScrollView
                contentContainerStyle={styles.sheetBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.sheetSubtitle}>
                  {'Choose how much to request and we will generate a VerusPay invoice with optional conversion support.'}
                </Text>

                <View style={styles.sheetFieldGroup}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>{'Invoice amount'}</Text>
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
                    <Button
                      mode="outlined"
                      textColor={Colors.primaryColor}
                      style={styles.amountToggle}
                      onPress={() => setAmountFiat(!amountFiat)}
                    >
                      {amountFiat ? coinObj.display_ticker : displayCurrency}
                    </Button>
                  </View>
                </View>

                {conversionEligible && amountHasValue && (
                  <View style={styles.sheetFieldGroup}>
                    <Checkbox.Item
                      label={'Allow payment with conversion from a PBaaS currency'}
                      status={allowConversion ? 'checked' : 'unchecked'}
                      onPress={() => setAllowConversion(!allowConversion)}
                      color={Colors.primaryColor}
                      uncheckedColor={Colors.tertiaryColor}
                      style={styles.checkboxRow}
                      labelStyle={styles.checkboxLabel}
                    />
                    {generalSettings.allowSettingVerusPaySlippage && allowConversion && (
                      <View style={styles.slippageRow}>
                        <Text style={styles.sectionLabel}>{'Maximum slippage (%)'}</Text>
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
                  disabled={loading || !address}
                  style={styles.sheetPrimaryButton}
                  contentStyle={styles.sheetPrimaryButtonContent}
                  labelStyle={styles.sheetPrimaryButtonLabel}
                >
                  {loading ? 'Generating…' : 'Generate invoice'}
                </Button>

                {showingInvoice && (
                  <View style={styles.sheetQrPreview}>
                    <QRCode
                      value={qrValue || '-'}
                      size={200}
                      logo={showVerusIcon ? require('../../images/customIcons/Verus.png') : undefined}
                      logoSize={showVerusIcon ? 48 : undefined}
                      logoBackgroundColor={showVerusIcon ? 'white' : undefined}
                      logoBorderRadius={showVerusIcon ? 80 : undefined}
                    />
                    <Text style={styles.qrLabel}>
                      {showingInvoice ? 'VerusPay invoice QR' : 'Wallet address QR'}
                    </Text>
                    <Button
                      mode="text"
                      onPress={resetToAddressQr}
                      textColor={Colors.primaryColor}
                      contentStyle={styles.sheetTextButtonContent}
                      labelStyle={styles.sheetTextButtonLabel}
                    >
                      {'Show address QR'}
                    </Button>
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
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.secondaryColor,
  },
  scrollContent: {
    paddingTop: 18,
    paddingBottom: 64,
    paddingHorizontal: 20,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  assetInfo: {
    flex: 1,
    paddingRight: 16,
  },
  assetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIconWrapper: {
    marginRight: 12,
  },
  assetName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.quinaryColor,
    letterSpacing: -0.5,
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
  qrSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  qrLabel: {
    fontSize: 13,
    color: Colors.verusDarkGray,
    marginTop: 14,
  },
  qrActionButton: {
    marginTop: 6,
  },
  section: {
    width: '100%',
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.quinaryColor,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.verusDarkGray,
  },
  addressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  copiedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.verusGreenColor,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#F8F9FA',
  },
  addressValue: {
    flex: 1,
    fontSize: 14,
    color: Colors.quinaryColor,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.1,
    paddingRight: 12,
  },
  copyIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInputContainer: {
    flex: 1,
    marginRight: 16,
  },
  amountInput: {
    backgroundColor: 'transparent',
    fontSize: 20,
  },
  errorText: {
    fontSize: 12,
    color: Colors.warningButtonColor,
    marginTop: 6,
  },
  amountToggle: {
    borderRadius: 18,
    borderColor: Colors.primaryColor,
  },
  checkboxRow: {
    paddingHorizontal: 0,
    marginLeft: -8,
  },
  checkboxLabel: {
    color: Colors.quinaryColor,
    fontSize: 14,
    lineHeight: 20,
  },
  slippageRow: {
    marginTop: 16,
  },
  paymentCard: {
    width: '100%',
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    backgroundColor: '#F8F9FA',
  },
  paymentCardContent: {
    marginBottom: 20,
  },
  paymentCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.quinaryColor,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  paymentCardSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    lineHeight: 20,
  },
  paymentCardButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  createButton: {
    borderRadius: 24,
    backgroundColor: Colors.primaryColor,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  createButtonContent: {
    height: 40,
    paddingHorizontal: 12,
  },
  createButtonLabel: {
    color: Colors.secondaryColor,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0,
    textTransform: 'none',
  },
  howItWorksLink: {
    paddingVertical: 8,
  },
  howItWorksLinkText: {
    fontSize: 14,
    color: '#666666',
    textDecorationLine: 'underline',
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
});

export default ReceiveAssetDetails;
