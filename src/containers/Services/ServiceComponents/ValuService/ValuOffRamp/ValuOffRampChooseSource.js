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
  Dimensions
} from 'react-native';
import { 
  Divider, 
  List, 
  Button, 
  Text, 
  RadioButton, 
  Portal, 
  TextInput, 
  IconButton, 
  ActivityIndicator 
} from 'react-native-paper';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { formatCurrency } from "react-native-format-currency";
import {CommonActions} from '@react-navigation/native';

import { VALU_URL } from "../../../../../utils/constants/constants";

// Local imports
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { Valu, VUSDC } from "../../../../../images/customIcons";
import ValuProvider from "../../../../../utils/services/ValuProvider";
import { ISO_3166_COUNTRIES } from "../../../../../utils/constants/iso3166";
import ListSelectionModal from "../../../../../components/ListSelectionModal/ListSelectionModal";
import { requestPersonalData } from "../../../../../utils/auth/authBox";
import { PERSONAL_LOCATIONS } from "../../../../../utils/constants/personal";
import { modifyPersonalDataForUser } from "../../../../../actions/actionDispatchers";
import { createAlert, resolveAlert } from '../../../../../actions/actions/alert/dispatchers/alert';
import { initiateOfframpRequest } from "../../../../../actions/actions/channels/valu/dispatchers/ValuWalletReduxManager";
import NumericKeypad from '../../../../../components/Keypad/NumericKeypad';
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
      radioValue: null, // Changed from 0 to null to force explicit selection
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
      showScrollIndicator: true
    };
    
    this.handleChange = this.handleChange.bind(this);
    this.openAddressModal = this.openAddressModal.bind(this);
    this.startOnRamp = this.startOnRamp.bind(this);
  }

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
      
      const radioValue = this.state.radioValue !== null ? this.state.radioValue : 0;
      const fee = valuReply.options?.[radioValue]?.feePercentage || 0;
      const cryptoReceived = valuReply.options?.[radioValue]?.amountReceived || 0;
      const formattedValue = formatCurrency({ 
        amount: Number(cryptoReceived).toFixed(2), 
        code: 'USD' 
      });

      this.setState({
        locations: location,
        taxCountry: location?.tax_countries?.[0] || {},
        currency: valuReply.currency || "USD",
        options: valuReply.options || [],
        converted: formattedValue[1],
        totalFee: (Number(amount) * (fee / 100)).toFixed(2),
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
    // Extra safety: prevent starting if an inline error is present or amount is empty or no payment option selected
    if (this.state.error != null || this.state.amount === "" || this.state.radioValue === null) return;
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
        const radioValue = this.state.radioValue !== null ? this.state.radioValue : 0;
        const selectedCountry = countryCode || this.state.taxCountry.country;
        
        const valuReply = await ValuProvider.getOffRampOptions({ 
          countryCode: selectedCountry, 
          amount: youPay,
          partnerUserId: this.state.partnerUserId
        });

        // Validate amount against min/max
        if (valuReply.options && valuReply.options[radioValue]) {
          this.validateAmount(
            youPay, 
            valuReply.options[radioValue].minAmount, 
            valuReply.options[radioValue].maxAmount
          );

          const fee = valuReply.options[radioValue].feePercentage || 0;
          const cryptoReceived = valuReply.options[radioValue].amountReceived || 0;
          const formattedValue = formatCurrency({ 
            amount: Number(cryptoReceived).toFixed(2), 
            code: 'USD' 
          });

          const updates = {
            totalFee: (Number(youPay) * (fee / 100)).toFixed(2),
            options: valuReply.options || [],
            converted: formattedValue[1],
            loading: false,
            updatingfee: false
          };

          if (countryCode) {
            updates.taxCountry = {
              ...this.state.taxCountry,
              country: countryCode,
            };
            updates.currency = valuReply.currency;
            // Reset selection when country changes
            updates.radioValue = null;
          }

          this.setState(updates, () => {
            if (countryCode) {
              this.updateTaxCountry();
            }
          });
        }
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
    const radioValue = this.state.radioValue !== null ? this.state.radioValue : 0;
    const providerMin = this.state.options?.[radioValue]?.minAmount || 0;

    if (amount > available) return { state: 'exceeds', available, amount, providerMin };
    if (amount < providerMin && providerMin > 0) return { state: 'below_min', available, amount, providerMin };
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
    
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            {this.renderModals()}
            
            {/* Main content container */}
            <View style={styles.modernContainer}>
            {/* Header: minimal, right-aligned country chip only */}
            <View style={[styles.header, { paddingBottom: 4 }]}>
              <View style={{ flex: 1 }} />
              {this.renderCountrySelector()}
            </View>
              
              
              {this.renderCurrencyInputs()}
              
              {/* Options list - takes remaining space */}
              <View style={{ flex: 1, minHeight: 0 }}>
                {this.renderOptionsList()}
              </View>
              
              {/* Modern CTA Button */}
              <View style={[styles.ctaContainer, isSmall ? { paddingBottom: 4 } : null ]}>
              <Button
                onPress={this.startOnRamp}
                mode="contained"
                disabled={ctaDisabled}
                style={[
                  styles.modernActionButton,
                  ctaDisabled ? styles.modernActionButtonDisabled : null,
                ]}
                contentStyle={[styles.modernActionButtonContent, { flexDirection: 'row-reverse' }]}
                labelStyle={[
                  styles.modernActionButtonLabel,
                  ctaDisabled ? styles.modernActionButtonLabelDisabled : null,
                ]}
                icon="open-in-new"
              >
                Choose payout method
              </Button>
              </View>
            </View>
            
            {/* Full-width keypad at bottom - outside main container */}
            <View style={[styles.fullWidthKeypadContainer, isSmall ? { paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 12 : 8 } : null]}>
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
                rowSpacing={isSmall ? 4 : 6}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    );
  }

  // Skeleton loading for payment options
  renderSkeletonOptions() {
    return (
      <View style={{ width: '100%', alignItems: 'center', marginTop: 4 }}>
        <View style={{ width: '90%', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 13, color: '#666' }}>Payment options</Text>
          <Text style={{ fontSize: 13, color: '#666' }}>Receive {this.state.currency}</Text>
        </View>
        <View style={styles.skeletonOptionsContainer}>
          {/* Skeleton Option 1 */}
          <View style={styles.skeletonRow3Column}>
            <View style={[styles.skeletonText, { flex: 2, marginRight: 8 }]} />
            <View style={[styles.skeletonText, { flex: 1, marginHorizontal: 4, width: 30 }]} />
            <View style={[styles.skeletonText, { flex: 1, marginLeft: 8, width: 50 }]} />
          </View>
          <View style={styles.optionDivider} />
          
          {/* Skeleton Option 2 */}
          <View style={styles.skeletonRow3Column}>
            <View style={[styles.skeletonText, { flex: 2, marginRight: 8 }]} />
            <View style={[styles.skeletonText, { flex: 1, marginHorizontal: 4, width: 30 }]} />
            <View style={[styles.skeletonText, { flex: 1, marginLeft: 8, width: 50 }]} />
          </View>
        </View>
      </View>
    );
  }

  // Payment options list with payment method, fee %, and total received (sorted by lowest fee)
  renderOptionsList() {
    const { height, width } = Dimensions.get('window');
    const isSmall = height <= 667 || width <= 375;
    const { options, loading, radioValue, showScrollIndicator } = this.state;

    if (loading) return this.renderSkeletonOptions();
    if (!Array.isArray(options) || options.length === 0) return null;

    const formatNum = (n) => {
      if (n == null) return '—';
      const parts = String(Number(n).toFixed(2)).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    };

    // Options are already sorted in state
    return (
      <View style={{ width: '100%', alignItems: 'center', marginTop: 4, flex: 1 }}>
        <View style={{ width: '90%', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 13, color: '#666' }}>Payment options</Text>
          <Text style={{ fontSize: 13, color: '#666' }}>Receive {this.state.currency}</Text>
        </View>
        <View style={{ flex: 1, width: '90%', position: 'relative' }}>
          <ScrollView 
            style={styles.optionsScrollContainer}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            onScroll={() => {
              if (showScrollIndicator) {
                this.setState({ showScrollIndicator: false });
              }
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.optionsContainer}>
              {options.map((route, idx) => {
                const isSelected = radioValue === idx;
                return (
                  <TouchableOpacity
                    key={`${route.paymentMethod}-${idx}`}
                    onPress={() => this.setState({ radioValue: idx, showScrollIndicator: false })}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.selectableOptionRow,
                      isSelected && styles.selectedOptionRow,
                      isSmall && { paddingVertical: 6 }
                    ]}>
                      <RadioButton
                        value={idx.toString()}
                        status={isSelected ? 'checked' : 'unchecked'}
                        onPress={() => this.setState({ radioValue: idx, showScrollIndicator: false })}
                        color={Colors.primaryColor}
                      />
                      <View style={styles.optionContent}>
                        <Text style={[styles.optionMethod, isSelected && styles.selectedOptionText]}>
                          {route.paymentMethod}
                        </Text>
                        <Text style={[styles.optionFee, isSelected && styles.selectedOptionText]}>
                          {`${Number(route.feePercentage || 0).toFixed(1)}%`}
                        </Text>
                        <Text style={[styles.optionReceive, isSelected && styles.selectedOptionText]}>
                          {formatNum(route.amountReceived)}
                        </Text>
                      </View>
                    </View>
                    {idx < options.length - 1 && (
                      <View style={[styles.optionDivider, isSmall && { marginVertical: 2 }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          
          {/* Floating scroll indicator */}
          {showScrollIndicator && options.length > 3 && (
            <View style={styles.scrollIndicatorContainer}>
              <Text style={styles.scrollIndicatorArrow}>↓</Text>
            </View>
          )}
        </View>
      </View>
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
    paddingBottom: 8,
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
    height: 48,
  },
  modernActionButtonLabel: {
    color: Colors.secondaryColor,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0,
    textTransform: 'none',
  },
  modernActionButtonLabelDisabled: {
    color: '#F0F9FC',
  },
  keypadContainer: {
    backgroundColor: '#FAFAFA',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  fullWidthKeypadContainer: {
    backgroundColor: '#FAFAFA',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
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