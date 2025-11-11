/*
  Updated file: ValuOffRampChooseSource
  - Redesigned Sell screen to match modern on-ramp style (based on ValuOnRampChooseSource)
  - Large "You Sell" input with balance display and MAX button below
  - Full-width keypad at bottom with modern styling and shadows
  - Small country selector chip in top-right corner
  - Modern CTA button with HomeFAB styling (rounded, shadows)
  - Light background with card-based input containers
  - Compact responsive layout for small devices
  - Balance display shows available vUSDC.vETH with lighter .vETH suffix
  - MAX button sets amount to available balance (respecting provider limits)
  - Payout methods moved into shared ValuPaymentMethodSheet with fee and limit details
  - Normalizes payout method labels/icons using shared metadata helper
  - Aligned loading skeleton visuals with ValuOnRampChooseSource
*/

import React, { Component } from "react";
import { connect } from 'react-redux';
import { primitives } from "verusid-ts-client";
import {
  SafeAreaView,
  ScrollView,
  View,
  TouchableWithoutFeedback,
  Linking,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableOpacity,
  Platform,
  Dimensions,
  Image
} from 'react-native';
import { 
  Button, 
  Text, 
  Portal 
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { formatCurrency } from "react-native-format-currency";
import {CommonActions} from '@react-navigation/native';

import { VALU_URL } from "../../../../../utils/constants/constants";

// Local imports
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { Valu, VUSDC, USDCIcon } from "../../../../../images/customIcons";
import ValuProvider from "../../../../../utils/services/ValuProvider";
import { ISO_3166_COUNTRIES } from "../../../../../utils/constants/iso3166";
import ListSelectionModal from "../../../../../components/ListSelectionModal/ListSelectionModal";
import { requestPersonalData } from "../../../../../utils/auth/authBox";
import { PERSONAL_LOCATIONS } from "../../../../../utils/constants/personal";
import { modifyPersonalDataForUser } from "../../../../../actions/actionDispatchers";
import { createAlert, resolveAlert } from '../../../../../actions/actions/alert/dispatchers/alert';
import { initiateOfframpRequest } from "../../../../../actions/actions/channels/valu/dispatchers/ValuWalletReduxManager";
import NumericKeypad from '../../../../../components/Keypad/NumericKeypad';
import ValuPaymentMethodSheet from '../shared/ValuPaymentMethodSheet';
import { normalizePaymentMethodLabel } from '../shared/valuPaymentMethodMeta';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { extractLedgerData } from '../../../../../utils/ledger/extractLedgerData';
import { API_GET_BALANCES } from '../../../../../utils/constants/intervalConstants';

// Constants
const ALLOWED_COUNTRIES = ["US", "CA", "GB", "AT", "BE", "CY", "CZ", "EE", "FI", "FR", "DE", 
  "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "RO", "SK", "SI", "ES"];

class ValuOffRampChooseSource extends Component {
  constructor(props) {
    super(props);

    const Ticker = Object.keys(props.activeAccount.testnetOverrides).length > 0 ? "VRSCTEST" : "VRSC";
    const addresses = props.allSubWallets[Ticker] || [];

    const partnerUserId = props.valuService.partnerUserId || null;

    if (partnerUserId == null) {
      throw new Error("No partner user ID found for Valu service");
    }

    // Calculate default amount as max available for initial address
    const initialAddress = props.initialAddress ? props.initialAddress : (addresses[0] || {});
    const allBalances = props.allBalances;
    const vusdcId = 'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd';
    const initialAvailable = initialAddress.id && allBalances[vusdcId] && allBalances[vusdcId][initialAddress.id] && allBalances[vusdcId][initialAddress.id].total
      ? Number(allBalances[vusdcId][initialAddress.id].total)
      : 0;
    const defaultAmount = initialAvailable > 0 ? (Math.floor(initialAvailable * 100) / 100).toFixed(2) : "100";

    this.state = {
      radioValue: null,
      amount: defaultAmount,
      converted: 0,
      taxCountry: null,
      currency: "USD",
      countryModalOpen: false,
      addressModalOpen: false,
      options: [],
      loading: false,
      updatingfee: false,
      totalFee: "0",
      error: null,
      mainVerusNetwork: Ticker,
      addresses,
      chosenAddress: initialAddress,
      locations: {},
      partnerUserId: partnerUserId,
      paymentSheetVisible: false,
      reviewVisible: false
    };
    
    this.handleChange = this.handleChange.bind(this);
    this.openAddressModal = this.openAddressModal.bind(this);
    this.startOnRamp = this.startOnRamp.bind(this);
  }

  formatTokenAmount = (value) => {
    if (value == null || value === "") return "0.00";
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  renderPaymentSelector() {
    const { options, radioValue, loading } = this.state;
    const selectedOption =
      radioValue != null && options && options[radioValue]
        ? options[radioValue]
        : null;

    const rawMax =
      selectedOption && selectedOption.maxAmount != null
        ? this.formatCurrencyValue(selectedOption.maxAmount, { includeDecimals: false, includeSymbol: true })
        : null;
    const payoutLabel = selectedOption
      ? normalizePaymentMethodLabel(selectedOption.paymentMethod) || selectedOption.paymentMethod
      : null;
    
    if (loading) {
      return (
        <View style={styles.paymentSelectorContainer}>
          <View style={styles.paymentSelectorSurface}>
            <View style={styles.paymentSelectorRowFlat}>
              <View style={styles.skeletonIconPlaceholder} />
              <View style={styles.paymentSelectorTextColumn}>
                <View style={styles.skeletonTextLine} />
                <View style={styles.skeletonTextLineShort} />
              </View>
              <View style={styles.skeletonChevronPlaceholder} />
            </View>
            <View style={styles.paymentSelectorVerticalLine} />
            <View style={styles.paymentSelectorRowFlat}>
              <View style={styles.skeletonIconPlaceholder} />
              <View style={styles.paymentSelectorTextColumn}>
                <View style={styles.skeletonTextLine} />
                <View style={styles.skeletonTextLineShort} />
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="transparent" />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.paymentSelectorContainer}>
        <View style={styles.paymentSelectorSurface}>
          <TouchableOpacity
            onPress={() => this.setState({ paymentSheetVisible: true })}
            activeOpacity={0.7}
            disabled={loading}
          >
            <View style={styles.paymentSelectorRowFlat}>
              <MaterialCommunityIcons name="credit-card-outline" size={24} color="#000" style={{ marginRight: 12 }} />
              <View style={styles.paymentSelectorTextColumn}>
                <Text style={styles.paymentSelectorFlatLabel}>Payout to</Text>
                <Text style={styles.paymentSelectorFlatValue}>
                  {payoutLabel || 'Select payout method'}
                </Text>
              </View>
              {selectedOption && rawMax ? (
                <View style={styles.paymentSelectorLimitGroup}>
                  <Text style={styles.paymentSelectorLimitValue}>{rawMax}</Text>
                  <Text style={styles.paymentSelectorLimitLabel}>Limit</Text>
                </View>
              ) : null}
              <MaterialCommunityIcons name="chevron-right" size={24} color="#888" />
            </View>
          </TouchableOpacity>

          <View style={styles.paymentSelectorVerticalLine} />

          <View style={styles.paymentSelectorRowFlat}>
            <Image source={USDCIcon} style={styles.paymentSelectorUSDCIcon} />
            <View style={styles.paymentSelectorTextColumn}>
              <Text style={styles.paymentSelectorFlatLabel}>Sell</Text>
              <Text style={styles.paymentSelectorFlatValue}>vUSDC</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="transparent" />
          </View>
        </View>
      </View>
    );
  }

  renderPaymentMethodSheet() {
    return (
      <ValuPaymentMethodSheet
        visible={this.state.paymentSheetVisible}
        onDismiss={() => this.setState({ paymentSheetVisible: false })}
        options={this.state.options}
        selectedIndex={this.state.radioValue}
        currency={this.state.currency}
        mode="sell"
        onSelect={(option, index) => {
          const amountValue = this.state.amount === "" ? "0" : this.state.amount;
          const amountNumber = Number(amountValue);
          const fee = option?.feePercentage || 0;
          const totalFee = option
            ? (amountNumber * (fee / 100)).toFixed(2)
            : "0";
          const formattedValue =
            option != null
              ? formatCurrency({
                  amount: Number(option.amountReceived || 0).toFixed(2),
                  code: this.state.currency || 'USD',
                })
              : [];

          this.setState(
            {
              radioValue: index,
              totalFee,
              converted: formattedValue?.[1] || this.state.converted,
            },
            () => {
              if (option && this.state.amount !== "") {
                this.validateAmount(
                  this.state.amount,
                  option.minAmount,
                  option.maxAmount
                );
              }
            }
          );
        }}
      />
    );
  }

  handleReviewPress = () => {
    const validation = this.getAmountValidationState();
    if (
      this.state.loading ||
      this.state.amount === "" ||
      this.state.radioValue === null ||
      validation.state !== 'valid'
    ) {
      return;
    }

    this.setState({ reviewVisible: true });
  };

  closeReview = () => {
    this.setState({ reviewVisible: false });
  };

  renderReviewScreen(isSmall) {
    const selectedOption = this.getSelectedOption();
    const amountNumber = Number(this.state.amount || 0);
    const formattedSellAmount = this.formatTokenAmount(this.state.amount || 0);
    const payoutLabel = selectedOption
      ? normalizePaymentMethodLabel(selectedOption.paymentMethod) || selectedOption.paymentMethod
      : null;

    const fiatReceived =
      selectedOption && selectedOption.amountReceived != null
        ? Number(selectedOption.amountReceived)
        : 0;
    const formattedFiat =
      this.formatCurrencyValue(fiatReceived, { includeDecimals: false, includeSymbol: true }) || this.state.converted;

    const price =
      amountNumber > 0 && fiatReceived > 0 ? fiatReceived / amountNumber : null;
    const formattedPrice = price ? this.formatCurrencyValue(price, { includeDecimals: true, includeSymbol: true }) : null;

    const feePercentage =
      selectedOption && selectedOption.feePercentage != null
        ? Number(selectedOption.feePercentage)
        : null;
    const feeAmount =
      feePercentage != null ? amountNumber * (feePercentage / 100) : 0;
    const formattedFee =
      feePercentage != null ? this.formatCurrencyValue(feeAmount, { includeDecimals: true, includeSymbol: true }) : null;

    const chosenAddressLabel = this.state.chosenAddress?.name || this.state.chosenAddress?.address || 'Source address';
    const validation = this.getAmountValidationState();
    let validationError = null;
    if (validation.state === 'exceeds') {
      validationError = 'Amount exceeds available balance';
    } else if (validation.state === 'below_min' && validation.providerMin != null) {
      validationError = `Minimum ${this.formatTokenAmount(validation.providerMin)} vUSDC`;
    }
    const baseError = this.state.error
      ? this.state.error.replace(/^ -\s*/, '')
      : null;
    const errorMessage = baseError || validationError;
    const actionDisabled = this.state.loading || !!errorMessage;

    return (
      <View style={styles.reviewContainer}>
        <ScrollView
          style={styles.reviewScroll}
          contentContainerStyle={{ paddingBottom: isSmall ? 24 : 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Centered icon and title */}
          <View style={styles.reviewHero}>
            <Image source={USDCIcon} style={styles.reviewHeroIconLarge} />
            <Text style={styles.reviewHeroTitle}>
              {`Sell ${formattedSellAmount} vUSDC`}
            </Text>
            {formattedPrice && (
              <Text style={styles.reviewHeroSubtitle}>
                {`vUSDC price ${formattedPrice}`}
              </Text>
            )}
          </View>

          {/* Receive summary - flat style */}
          <View style={styles.reviewSummaryFlat}>
            <View style={styles.reviewSummaryRowFlat}>
              <Text style={styles.reviewSummaryLabelFlat}>Receive</Text>
              <Text style={styles.reviewSummaryValueFlat}>{formattedFiat}</Text>
            </View>
            <View style={styles.reviewSummaryRowFlat}>
              <Text style={styles.reviewSummaryLabelFlat}>From address</Text>
              <Text style={styles.reviewSummaryValueFlat}>{chosenAddressLabel}</Text>
            </View>
          </View>

          {/* Payout method row (flat style) */}
          <TouchableOpacity
            onPress={() => this.setState({ paymentSheetVisible: true })}
            style={styles.reviewPaymentRow}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="credit-card-outline" size={24} color="#000" style={{ marginRight: 12 }} />
            <View style={styles.reviewPaymentTextColumn}>
              <Text style={styles.reviewPaymentLabel}>Payout to</Text>
              <Text style={styles.reviewPaymentValue}>
                {payoutLabel || 'Select payout method'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#888" />
          </TouchableOpacity>

          {/* Disclosure */}
          <View style={styles.reviewDisclosure}>
            <Text style={[styles.reviewDisclosureText, { marginBottom: 0 }]}>
              Payouts are processed by our partner. Depending on your payout method, funds may take up to a few business days to arrive.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.reviewFooter}>
          <View style={styles.reviewTotalContainer}>
            <Text style={styles.reviewTotalLabel}>{`${formattedFiat} total`}</Text>
            {feePercentage != null && formattedFee ? (
              <Text style={styles.reviewTotalSubLabel}>
                {`incl. ${feePercentage.toFixed(1)}% fee (${formattedFee})`}
              </Text>
            ) : null}
          </View>
          {errorMessage ? (
            <View style={[styles.errorBanner, { marginBottom: 12 }]}>
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}
          <View
            style={[
              styles.reviewActionWrapper,
              actionDisabled ? styles.reviewActionWrapperDisabled : null,
            ]}
          >
            {!actionDisabled && (
              <Svg
                width="100%"
                height="100%"
                style={styles.reviewActionGradient}
                pointerEvents="none"
              >
                <Defs>
                  <SvgLinearGradient id="reviewButtonGradientOfframp" x1="0" y1="0" x2="1" y2="1">
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
                  fill="url(#reviewButtonGradientOfframp)"
                />
              </Svg>
            )}
            <Button
              mode="contained"
              onPress={this.startOnRamp}
              disabled={actionDisabled}
              icon="open-in-new"
              style={styles.reviewActionButton}
              contentStyle={[styles.modernActionButtonContent, styles.reviewActionButtonContent, { flexDirection: 'row-reverse' }]}
              labelStyle={[
                styles.modernActionButtonLabel,
                styles.reviewActionButtonLabel,
                actionDisabled ? styles.modernActionButtonLabelDisabled : null,
              ]}
            >
              Sell now
            </Button>
          </View>
        </View>
      </View>
    );
  }

  getSelectedOption = () => {
    const { options, radioValue } = this.state;
    if (radioValue == null || !Array.isArray(options)) return null;
    return options[radioValue] || null;
  };

  formatCurrencyValue = (amount, options = {}) => {
    const { currency } = this.state;
    if (amount == null || amount === "") return null;

    const { includeDecimals = true, includeSymbol = false } = options;
    const fixedAmount = includeDecimals 
      ? Number(amount).toFixed(2) 
      : Math.floor(Number(amount)).toString();

    try {
      const formatted = formatCurrency({
        amount: fixedAmount,
        code: currency || 'USD',
      });
      return includeSymbol ? formatted?.[0] || null : formatted?.[1] || null;
    } catch (error) {
      const fallback = includeSymbol 
        ? `${currency || ''}${fixedAmount}`.trim()
        : `${fixedAmount} ${currency || ''}`.trim();
      return fallback;
    }
  };

  buildLimitLabel = (option) => {
    if (!option) return null;

    const max = this.formatCurrencyValue(option.maxAmount, { includeDecimals: false, includeSymbol: true });

    if (max) return `${max} limit`;
    return null;
  };

  async componentDidMount() {
      this.initialize();
  }

  async connectionError() {
    createAlert(
      "Failed to Connect to Valu",
      "Please try again soon.  We apologise for the inconvenience",
      [
        {
          text: 'back',
          onPress: () => {resolveAlert(false); this.props.navigation.goBack()},
          style: 'cancel',
        },
        {
          text: 'TRY AGAIN', 
          onPress: async () => {
            try {
              await this.initialize();
  
              resolveAlert(true);
            } catch (error) {
              console.error("Error starting off-ramp:", error);
              this.connectionError();
              resolveAlert(false);
            }
          }
        },
      ],
      { cancelable: false }
    );
  }
  
  async initialize() {

    this.setState({ loading: true });
    
    try {
      const location = await requestPersonalData(PERSONAL_LOCATIONS);
      const countryCode = location?.tax_countries?.[0]?.country || "US";
      const amount = this.state.amount;
      
      const valuReply = await ValuProvider.getOffRampOptions({ 
        countryCode, 
        amount,
        partnerUserId: this.state.partnerUserId 
      });
      
      const currentSelection = this.state.radioValue;
      const selectedOption =
        currentSelection != null && valuReply.options
          ? valuReply.options[currentSelection]
          : null;
      const fee = selectedOption?.feePercentage || 0;
      const fiatReceived = selectedOption?.amountReceived || 0;
      const formattedValue = selectedOption
        ? formatCurrency({
            amount: Number(fiatReceived).toFixed(2),
            code: valuReply.currency || 'USD',
          })
        : [];

      this.setState({
        locations: location,
        taxCountry: location?.tax_countries?.[0] || {},
        currency: valuReply.currency || "USD",
        options: valuReply.options || [],
        converted: formattedValue?.[1] || this.state.converted,
        totalFee: selectedOption ? (Number(amount) * (fee / 100)).toFixed(2) : "0",
        loading: false,
      });
    } catch (error) {
      this.connectionError();
    }
  }

  updateTaxCountry() {
    this.setState({ loading: true }, async () => {
      try {
        const taxCountries = [this.state.taxCountry];
        
        await modifyPersonalDataForUser(
          { ...this.state.locations, tax_countries: taxCountries },
          PERSONAL_LOCATIONS,
          this.props.activeAccount.accountHash
        );
      } catch (error) {
        console.error("Error updating tax country:", error);
      } finally {
        this.setState({ loading: false });
      }
    });
  }

  resetToScreen = () => {
      const resetAction = CommonActions.reset({
              index: 0,
              routes: [{name: 'SignedInStack'}],
            });

      this.props.navigation.dispatch(resetAction);
    };

  async startOnRamp() {
    // Extra safety: prevent starting if an inline error is present or amount is empty
    if (this.state.error != null || this.state.amount === "" || this.state.radioValue === null) return;
    this.setState({ reviewVisible: false });
    try {
      const { options, radioValue, amount, taxCountry } = this.state;
      const reply = await ValuProvider.getOffRampURL({
        option: options[radioValue],
        amount,
        countryCode: taxCountry.country,
        address: this.state.chosenAddress.id,
        partnerUserId: this.state.partnerUserId
      });

      initiateOfframpRequest({
        requestId: reply.requestId,
        status: 'AWAITING_PAYMENT',
        url: `${VALU_URL}/offramp/userpaymentcheck?requestId=${reply.requestId}&OffRampLastStep=true`
      });

      if (await InAppBrowser.isAvailable()) {
        InAppBrowser.open(reply.url, {
          // iOS Properties
          dismissButtonStyle: 'cancel',
          preferredBarTintColor: '#00A1CC',
          preferredControlTintColor: 'white',
          readerMode: false,
          animated: true,
          modalPresentationStyle: 'fullScreen',
          modalTransitionStyle: 'coverVertical',
          modalEnabled: true,
          enableBarCollapsing: false,
          // Android Properties
          showTitle: false,
          toolbarColor: '#00A1CC',
          secondaryToolbarColor: 'black',
          navigationBarColor: 'black',
          navigationBarDividerColor: 'white',
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          forceCloseOnRedirection: false,
          hasBackButton: false,  // Prevent back button from closing the browser
          waitForRedirectDelay: 500, // Give redirects more time to process
          showInRecents: true,   // Keep in Android recents
          ephemeralWebSession: false, // Maintain cookies and session data
          animations: {
            startEnter: 'slide_in_right',
            startExit: 'slide_out_left',
            endEnter: 'slide_in_left',
            endExit: 'slide_out_right'
          }
        });
        this.resetToScreen();
      } else {
        Linking.openURL(reply.url);
      }
    } catch (error) {
      console.error("Error starting off-ramp:", error);
      Alert.alert("Error", "Failed to start the sell process. Please try again.");
    }
  }

  validateAmount(value, min, max) {
    // Clear old error state - validation now handled via inline color coding
    this.setState({ error: null });
    
    if (isNaN(value)) {
      return false;
    }

    if (Number(value) < Number(min)) {
      return false;
    }

    if (Number(value) > Number(max)) {
      return false;
    }

    return true;
  }

  handleChange(value = null, countryCode = null) {
    const youPay = value !== null && value !== undefined ? value : this.state.amount;

    if (youPay === '') {
      this.setState({ amount: '', error: null, loading: false, updatingfee: false });
      return;
    }

    if (youPay.includes('.') && youPay.split('.')[1]?.length > 2) {
      return;
    }

    this.setState({ 
      loading: true, 
      updatingfee: true, 
      amount: youPay 
    }, async () => {
      try {
        const currentSelection = this.state.radioValue;
        const selectedCountry = countryCode || this.state.taxCountry.country;
        
        const valuReply = await ValuProvider.getOffRampOptions({ 
          countryCode: selectedCountry, 
          amount: youPay,
          partnerUserId: this.state.partnerUserId
        });

        const options = valuReply.options || [];
        const hasSelection =
          currentSelection != null && options[currentSelection] != null;
        const selectedOption = hasSelection ? options[currentSelection] : null;

        if (hasSelection) {
          this.validateAmount(
            youPay,
            selectedOption.minAmount,
            selectedOption.maxAmount
          );
        }

        const fee = selectedOption?.feePercentage || 0;
        const fiatReceived = selectedOption?.amountReceived || 0;
        const formattedValue =
          selectedOption != null
            ? formatCurrency({
                amount: Number(fiatReceived).toFixed(2),
                code: valuReply.currency || 'USD',
              })
            : [];

        const updates = {
          totalFee: selectedOption
            ? (Number(youPay) * (fee / 100)).toFixed(2)
            : "0",
          options,
          converted: formattedValue?.[1] || this.state.converted,
          loading: false,
          updatingfee: false
        };

        if (!hasSelection) {
          updates.radioValue = null;
        }

        if (countryCode) {
          updates.taxCountry = {
            ...this.state.taxCountry,
            country: countryCode,
          };
          updates.currency = valuReply.currency;
          updates.radioValue = null;
        }

        this.setState(updates, () => {
          if (countryCode) {
            this.updateTaxCountry();
          }
        });
      } catch (error) {
        console.error("Error handling change:", error);
        this.setState({ 
          loading: false, 
          updatingfee: false,
          error: " - Failed to update values" 
        });
      }
    });
  }

  openAddressModal() {
    this.setState({ addressModalOpen: true });
  }

  handleMaxPress = () => {
    const allBalances = this.props.allBalances;
    const vusdcId = 'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd';
    const addrId = this.state.chosenAddress?.id;
    const available = addrId && allBalances[vusdcId] && allBalances[vusdcId][addrId] && allBalances[vusdcId][addrId].total
      ? Number(allBalances[vusdcId][addrId].total)
      : 0;

    if (available <= 0) return;

    // Get provider max if available
    const providerMax = this.state.options?.[this.state.radioValue]?.maxAmount;
    const maxAmount = providerMax ? Math.min(available, Number(providerMax)) : available;
    
    // Round DOWN to 2 decimals to ensure we never exceed actual balance
    const formattedMax = (Math.floor(maxAmount * 100) / 100).toFixed(2);
    this.handleChange(formattedMax);
  };

  // Get validation state for amount
  getAmountValidationState() {
    const allBalances = this.props.allBalances;
    const vusdcId = 'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd';
    const addrId = this.state.chosenAddress?.id;
    const available = addrId && allBalances[vusdcId] && allBalances[vusdcId][addrId] && allBalances[vusdcId][addrId].total
      ? Number(allBalances[vusdcId][addrId].total)
      : 0;

    const amount = Number(this.state.amount || 0);
    const selectedOption = this.getSelectedOption();
    const providerMin = selectedOption?.minAmount || 0;

    if (amount > available) return { state: 'exceeds', available, amount, providerMin };
    if (selectedOption && amount < providerMin && providerMin > 0) return { state: 'below_min', available, amount, providerMin };
    return { state: 'valid', available, amount, providerMin };
  }

  // Render helper methods to break down the UI
  renderCurrencyInputs() {
    const { height, width } = Dimensions.get('window');
    const isSmall = height <= 667 || width <= 375;
    const formatAmount = (raw = "") => {
      if (raw == null || raw === "") return "0";
      const [int = "0", frac] = String(raw).split('.');
      const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return frac != null ? `${withCommas}.${frac}` : withCommas;
    };

    // Use raw amount for display, only format if it has content
    const displayAmount = this.state.amount === "" ? "0" : formatAmount(this.state.amount);

    if (this.state.loading) {
      return (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <View style={{ width: '90%' }}>
            <View style={styles.skeletonAmountWrapper}>
              <View style={[styles.skeletonBlockLarge, isSmall ? styles.skeletonBlockLargeSmall : null]} />
            </View>
          </View>
        </View>
      );
    }
    
    const validation = this.getAmountValidationState();
    const { state: validationState, available } = validation;

    // Color coding based on validation state
    const amountColor = validationState === 'exceeds' ? '#FF4444' : 
                       validationState === 'below_min' ? '#FF8C00' : '#1A1A1A';
    
    const balanceColor = validationState === 'exceeds' ? '#FF4444' : '#888';
    const maxButtonStyle = validationState === 'exceeds' ? styles.maxButtonProminent : styles.maxButton;
    const maxButtonTextStyle = validationState === 'exceeds' ? styles.maxButtonTextProminent : styles.maxButtonText;

    return (
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        {/* Large You Sell input - simplified currency */}
        <View style={{ width: '90%', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'left' }}>You sell</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start', width: '100%' }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.5}
              style={[
                styles.mediumLargeAmountInline, 
                isSmall ? styles.mediumLargeAmountInlineSmall : null,
                { color: amountColor }
              ]}
            >
              {displayAmount}
              <Text style={[
                styles.mediumLargeCurrencyInline, 
                isSmall ? styles.mediumLargeCurrencyInlineSmall : null,
                { color: amountColor === '#1A1A1A' ? '#888' : amountColor }
              ]}>{`\u2009vUSDC`}</Text>
            </Text>
          </View>
          
          {/* Balance and MAX row with smart coloring */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: balanceColor }}>
                Available: {(Math.floor(available * 100) / 100).toFixed(2)} vUSDC<Text style={{ fontSize: 11, color: balanceColor === '#FF4444' ? '#FF6666' : '#aaa' }}>.vETH</Text>
              </Text>
              {/* Micro validation feedback */}
              {validationState === 'exceeds' && (
                <Text style={{ fontSize: 10, color: '#FF4444', marginTop: 2 }}>Exceeds available</Text>
              )}
              {validationState === 'below_min' && (
                <Text style={{ fontSize: 10, color: '#FF8C00', marginTop: 2 }}>Min {validation.providerMin}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={this.handleMaxPress}
              disabled={available <= 0}
              style={[
                maxButtonStyle,
                available <= 0 ? styles.maxButtonDisabled : null
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                maxButtonTextStyle,
                available <= 0 ? styles.maxButtonTextDisabled : null
              ]}>
                MAX
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  renderCountrySelector() {
    const countryData = this.state.taxCountry?.country ? ISO_3166_COUNTRIES[this.state.taxCountry.country] : null;

    if (this.state.loading) {
      return (
        <View style={styles.countryChipSkeleton} />
      );
    }
    
    return (
      <TouchableOpacity
        onPress={() => this.setState({ countryModalOpen: true })}
        style={styles.countryChip}
        activeOpacity={0.7}
      >
        <Text style={styles.countryChipText}>
          {countryData ? `${countryData.emoji} ${countryData.name}` : "Select country"}
        </Text>
        <Text style={styles.countryChipIcon}>⌄</Text>
      </TouchableOpacity>
    );
  }

  renderModals() {
    return (
      <Portal>
        {this.state.countryModalOpen && (
          <ListSelectionModal
            title="Select a Country"
            flexHeight={3}
            visible={this.state.countryModalOpen}
            onSelect={(item) => this.handleChange(null, item.key)}
            data={ALLOWED_COUNTRIES.map((code) => {
              const item = ISO_3166_COUNTRIES[code];
              return {
                key: code,
                title: `${item.emoji} ${item.name}`,
              };
            })}
            cancel={() => this.setState({ countryModalOpen: false })}
          />
        )}
        
        {this.state.addressModalOpen && (
          <ListSelectionModal
            title={`Select a ${this.state.mainVerusNetwork} address`}
            flexHeight={3}
            visible={this.state.addressModalOpen}
            onSelect={(item) => {
              this.setState({
                chosenAddress: item.address,
                addressModalOpen: false
              });
            }}
            data={this.state.addresses.map((address) => ({
              key: address.id || address.address,
              title: address.name || address.address,
              address: address
            }))}
            cancel={() => this.setState({ addressModalOpen: false })}
          />
        )}
      </Portal>
    );
  }

  render() {
    const { height, width } = Dimensions.get('window');
    const isSmall = height <= 667 || width <= 375;
    
    const validation = this.getAmountValidationState();
    const ctaDisabled = this.state.loading || this.state.amount === "" || validation.state !== 'valid' || this.state.radioValue === null;
    const primaryButtonLabel = this.state.radioValue === null ? 'Select payout method' : 'Review order';
    const reviewVisible = this.state.reviewVisible;
    let errorMessage = null;
    if (this.state.error) {
      errorMessage = this.state.error.replace(/^ -\s*/, '');
    } else if (validation.state === 'exceeds') {
      errorMessage = 'Amount exceeds available balance';
    } else if (validation.state === 'below_min' && validation.providerMin != null) {
      const formattedMin = this.formatTokenAmount(validation.providerMin);
      errorMessage = `Minimum ${formattedMin} vUSDC`;
    }
    
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            {this.renderModals()}
            {this.renderPaymentMethodSheet()}
            
            {reviewVisible ? (
              this.renderReviewScreen(isSmall)
            ) : (
              <>
                {/* Main content container */}
                <View style={styles.modernContainer}>
                  {/* Header: minimal, right-aligned country chip only */}
                  <View style={[styles.header, { paddingBottom: 4 }]}>
                    <View style={{ flex: 1 }} />
                    {this.renderCountrySelector()}
                  </View>
                  
                  {this.renderCurrencyInputs()}
                  {this.renderPaymentSelector()}
                  
                  {/* Spacer to push keypad and button to bottom */}
                  <View style={{ flex: isSmall ? 0 : 1 }} />
                  
                  {/* Modern CTA Button */}
                  <View style={[styles.ctaContainer, isSmall ? { paddingBottom: 3 } : { paddingBottom: 6 } ]}>
                    {errorMessage ? (
                      <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{errorMessage}</Text>
                      </View>
                    ) : (
                      <Button
                        onPress={this.handleReviewPress}
                        mode="contained"
                        disabled={ctaDisabled}
                        style={[
                          styles.modernActionButton,
                          ctaDisabled ? styles.modernActionButtonDisabled : null,
                        ]}
                        contentStyle={styles.modernActionButtonContent}
                        labelStyle={[
                          styles.modernActionButtonLabel,
                          ctaDisabled ? styles.modernActionButtonLabelDisabled : null,
                        ]}
                      >
                        {primaryButtonLabel}
                      </Button>
                    )}
                  </View>
                </View>
                
                {/* Full-width keypad at bottom - outside main container */}
                <View style={[styles.fullWidthKeypadContainer, isSmall ? { paddingTop: 0, paddingBottom: Platform.OS === 'ios' ? 4 : 2 } : null]}>
                  <NumericKeypad
                    value={this.state.amount}
                    onChange={(val) => this.handleChange(val)}
                    decimalPlaces={2}
                    keyWidth={undefined}
                    keyHeight={isSmall ? 36 : 50}
                    fontSize={isSmall ? 22 : 28}
                    keyRadius={0}
                    keyBackground={'transparent'}
                    containerPaddingHorizontal={0}
                    rowSpacing={isSmall ? 2 : 4}
                  />
                </View>
              </>
            )}
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    );
  }

}

const styles = StyleSheet.create({
  container: { 
    alignContent: 'center', 
    alignItems: 'center' 
  },
  modernContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  modernHeaderText: { 
    fontSize: 18, 
    fontWeight: '600',
    color: '#1A1A1A',
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  countryChipText: {
    fontSize: 12,
    color: '#333',
    marginRight: 4,
  },
  countryChipIcon: {
    fontSize: 12,
    color: '#888',
  },
  // Medium-large amount styles (smaller than on-ramp)
  mediumLargeAmountInline: {
    fontSize: 58,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
    includeFontPadding: false,
  },
  mediumLargeAmountInlineSmall: {
    fontSize: 46,
  },
  mediumLargeCurrencyInline: {
    fontSize: 58,
    fontWeight: '500',
    color: '#888',
    includeFontPadding: false,
  },
  mediumLargeCurrencyInlineSmall: {
    fontSize: 46,
  },
  mediumLargeCurrencyInlineLighter: {
    fontSize: 58,
    fontWeight: '400',
    color: '#aaa',
    includeFontPadding: false,
  },
  mediumLargeCurrencyInlineSmallLighter: {
    fontSize: 46,
  },
  maxButton: {
    backgroundColor: Colors.primaryColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  maxButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  maxButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.secondaryColor,
    letterSpacing: 0.5,
  },
  maxButtonTextDisabled: {
    color: '#999',
  },
  maxButtonProminent: {
    backgroundColor: '#FF4444',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  maxButtonTextProminent: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 0.5,
  },
  ctaContainer: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  paymentSelectorContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  paymentSelectorSurface: {
    width: '90%',
  },
  paymentSelectorRowFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  paymentSelectorTextColumn: {
    flex: 1,
    marginBottom: 2,
  },
  paymentSelectorFlatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  paymentSelectorFlatValue: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(26, 26, 26, 0.7)',
  },
  paymentSelectorLimitGroup: {
    marginRight: 8,
    alignItems: 'flex-end',
  },
  paymentSelectorLimitValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  paymentSelectorLimitLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(26, 26, 26, 0.7)',
    marginTop: 2,
  },
  paymentSelectorVerticalLine: {
    alignSelf: 'flex-start',
    marginLeft: 28,
    width: 1,
    height: 18,
    backgroundColor: '#E6E6E6',
  },
  paymentSelectorUSDCIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    marginRight: 12,
  },
  errorBanner: {
    backgroundColor: '#FFE8E6',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorBannerText: {
    color: '#B71C1C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  reviewScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  reviewHero: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  reviewHeroIconLarge: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  reviewHeroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  reviewHeroSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(26, 26, 26, 0.7)',
    textAlign: 'center',
  },
  reviewSummaryFlat: {
    marginBottom: 20,
  },
  reviewSummaryRowFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  reviewSummaryLabelFlat: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  reviewSummaryValueFlat: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviewPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
    marginBottom: 20,
  },
  reviewPaymentTextColumn: {
    flex: 1,
  },
  reviewPaymentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  reviewPaymentValue: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(26, 26, 26, 0.7)',
  },
  reviewDisclosure: {
    backgroundColor: '#F3F8FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  reviewDisclosureText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
    marginBottom: 6,
  },
  reviewFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E6E6E6',
    backgroundColor: '#FAFAFA',
  },
  reviewTotalContainer: {
    marginBottom: 12,
  },
  reviewTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviewTotalSubLabel: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  skeletonAmountWrapper: {
    height: 60,
    justifyContent: 'center',
  },
  skeletonBlockLarge: {
    height: 42,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
  },
  skeletonBlockLargeSmall: {
    height: 34,
  },
  skeletonIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8E8E8',
    marginRight: 12,
  },
  skeletonChevronPlaceholder: {
    width: 24,
    height: 24,
    marginLeft: 12,
    borderRadius: 12,
    backgroundColor: '#E8E8E8',
  },
  skeletonTextLine: {
    height: 16,
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    marginBottom: 6,
    width: '60%',
  },
  skeletonTextLineShort: {
    height: 14,
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    width: '40%',
  },
  countryChipSkeleton: {
    width: 140,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
  },
  reviewActionWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  reviewActionWrapperDisabled: {
    backgroundColor: '#CFEAF2',
  },
  reviewActionGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  reviewActionButton: {
    borderRadius: 28,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  modernActionButton: {
    borderRadius: 24,
    backgroundColor: Colors.primaryColor,
    // Remove any platform shadows
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  modernActionButtonDisabled: {
    backgroundColor: '#CFEAF2',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  modernActionButtonContent: {
    height: 56,
  },
  reviewActionButtonContent: {
    height: 56,
  },
  modernActionButtonLabel: {
    color: Colors.secondaryColor,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0,
    textTransform: 'none',
  },
  reviewActionButtonLabel: {
    fontSize: 18,
  },
  modernActionButtonLabelDisabled: {
    color: '#7DB8C9',
  },
  keypadContainer: {
    backgroundColor: '#FAFAFA',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  fullWidthKeypadContainer: {
    backgroundColor: '#FAFAFA',
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 6 : 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  optionsContainer: {
    width: '100%',
    paddingVertical: 4,
  },
  optionsScrollContainer: {
    width: '100%',
  },
  scrollIndicatorContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  scrollIndicatorArrow: {
    fontSize: 32,
    color: '#999',
    opacity: 0.6,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  selectableOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 2,
  },
  selectedOptionRow: {
    backgroundColor: '#E6F7FF',
    borderColor: Colors.primaryColor,
    borderWidth: 2,
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 8,
  },
  selectedOptionText: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  compactOptionRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 2,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 6,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  optionRow3Column: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  feeRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 4,
    marginHorizontal: 12,
  },
  optionMethod: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '500',
    flex: 2,
  },
  optionReceive: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  optionFee: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    flex: 1,
  },
  moreOptionsRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  moreOptionsText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  skeletonOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  skeletonOptionsContainer: {
    width: '90%',
    paddingVertical: 4,
  },
  skeletonCompactOptionRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 2,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 6,
  },
  skeletonOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  skeletonFeeRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  skeletonRow3Column: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  skeletonText: {
    height: 14,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    width: '80%',
  },
  headerText: { 
    fontSize: 18, 
    textAlign: 'center', 
    paddingVertical: 5, 
    fontWeight: 'bold' 
  },
  textInput: {
    paddingHorizontal: 10,
    width: 300,
    alignSelf: 'center',
    backgroundColor: "#eeeeee",
    fontSize: 18,
  },
  loadingIndicator: {
    width: 200, 
    height: 200, 
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tableCell: {
    flex: 1,
  },
  tableHeaderCell: {
    fontWeight: "bold", 
    textAlign: "left"
  },
  tableCellLabel: { 
    fontSize: 12, 
    color: '#888', 
    textAlign: "left" 
  },
  tableCellValue: { 
    fontSize: 14, 
    textAlign: "left" 
  },
  buttonLabel: { 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  actionButton: { 
    height: 41, 
    marginTop: 6, 
    width: 180 
  },
  countrySelector: {
    width: 200,
    height: 50,
    borderWidth: 1,
    borderColor: 'grey',
    borderRadius: 5,
    padding: 5
  }
});

const mapStateToProps = (state) => {

  return {
    activeAccount: state.authentication.activeAccount,
    encryptedPersonalData: state.personal,
    allSubWallets: state.coinMenus.allSubWallets,
    activeCoin: state.coins.activeCoinList,
    valuService: state.channelStore_valu_service,
    allBalances: extractLedgerData(state, 'balances', API_GET_BALANCES)
  };
};

export default connect(mapStateToProps)(ValuOffRampChooseSource);