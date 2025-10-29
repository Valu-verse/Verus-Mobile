/*
  Updated file: ValuOnRampChooseSource
  - Redesigned Buy screen to match Coinbase's modern, clean style
  - Large "You Pay" input with smaller "You Receive" display below
  - Full-width keypad at bottom with modern styling and shadows
  - Small country selector chip in top-right corner
  - Modern CTA button with HomeFAB styling (rounded, shadows)
  - Light background with card-based input containers
  - Removed amount suggestion chips for cleaner interface
  - Fee display condensed to single line with better typography
  - NEW: Compact responsive layout for small devices
    • Local compact rule: height <= 667 OR width <= 375 (iPhone SE class)
    • Reduce keypad height/spacing and typography sizes
    • Tighten options list spacing and ensure CTA remains visible
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
import { initiateOnrampRequest } from "../../../../../actions/actions/channels/valu/dispatchers/ValuWalletReduxManager";
import NumericKeypad from '../../../../../components/Keypad/NumericKeypad';
import { saveGeneralSettings } from "../../../../../actions/actionCreators";

// Constants
const ALLOWED_COUNTRIES = ["US", "CA", "GB", "AT", "BE", "CY", "CZ", "EE", "FI", "FR", "DE", 
  "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "RO", "SK", "SI", "ES"];

class ValuOnRampChooseSource extends Component {
  constructor(props) {
    super(props);

    const Ticker = Object.keys(props.activeAccount.testnetOverrides).length > 0 ? "VRSCTEST" : "VRSC";
    const addresses = props.allSubWallets[Ticker] || [];

    const partnerUserId = props.valuService.partnerUserId || null;

    if (partnerUserId == null) {
      throw new Error("No partner user ID found for Valu service");
    }

    this.state = {
      radioValue: 0,
      amount: "100",
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
      chosenAddress: (props.initialAddress ? props.initialAddress : (addresses[0] || {})),
      locations: {},
      partnerUserId: partnerUserId
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
              console.error("Error starting on-ramp:", error);
              connectionError();
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
      
      const valuReply = await ValuProvider.getOnRampOptions({ 
        countryCode, 
        amount,
        partnerUserId: this.state.partnerUserId 
      });
      
      const fee = valuReply.options?.[this.state.radioValue]?.feePercentage || 0;
      const cryptoReceived = valuReply.options?.[this.state.radioValue]?.amountReceived || 0;
      const formattedValue = formatCurrency({ 
        amount: Number(cryptoReceived).toFixed(2), 
        code: 'USD' 
      });

      const attestationStatus = valuReply.attestationStatus || null;

      if (attestationStatus && attestationStatus.data === "demo_mock_data") {
        // If demo data, show a mock attestation ready
        this.handleTransactionComplete({ success: true }, attestationStatus);
  
      }

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


  // Handle navigation to attestation acceptance screen
  navigateToAttestationAccept = (attestation, transactionData) => {
    
    if (this.props.setSubScreen) {
      // Use the setSubScreen method from parent ValuServiceAccount
  
      this.props.setSubScreen('attestationAccept', {
        attestation: attestation,
        transactionData: transactionData
      });
    } else {
      // Fallback to direct navigation if setSubScreen is not available
      
      try {
        // Try using push instead of navigate to ensure a new screen instance
        this.props.navigation.push('ValuAttestationAccept', {
          attestation: attestation,
          transactionData: transactionData
        });
      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback: try standard navigate
        this.props.navigation.navigate('ValuAttestationAccept', {
          attestation: attestation,
          transactionData: transactionData
        });
      }
    }
  };

  // Method to be called when transaction completes and attestation is available
  handleTransactionComplete = (transactionResult, attestation = null) => {
    const transactionData = {
      amount: this.state.amount,
      currency: this.state.currency,
      received: this.state.converted,
      address: this.state.chosenAddress?.name || 'Your Wallet',
      provider: this.state.options[this.state.radioValue]?.provider || 'Payment Provider'
    };

    if (attestation) {
      // Navigate to attestation acceptance screen
      this.navigateToAttestationAccept(attestation, transactionData);
    } else {
      // No attestation available, just go back to main screen
      this.resetToScreen();
    }
  };

  async startOnRamp() {
    // Extra safety: prevent starting if an inline error is present or amount is empty
    if (this.state.error != null || this.state.amount === "") return;

    const continueToCheckout = async () => {
      try {
        const { options, radioValue, amount, taxCountry } = this.state;
        const reply = await ValuProvider.getOnRampURL({
          option: options[radioValue],
          amount,
          countryCode: taxCountry.country,
          address: this.state.chosenAddress.id,
          partnerUserId: this.state.partnerUserId
        });

        initiateOnrampRequest(reply.requestId, reply.details);

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
        console.error("Error starting on-ramp:", error);
        Alert.alert("Error", "Failed to start the purchase process. Please try again.");
      }
    };

    const hasAccepted = this.props.generalWalletSettings &&
      this.props.generalWalletSettings.valuOnrampDisclosureAcceptedV1 === true;

    if (!hasAccepted) {
      createAlert(
        "Before you continue",
        "• Checkout runs on Ethereum behind the scenes.\n\n" +
        "• We convert your purchase to vUSDC at a 1:1 rate.\n\n" +
        "• vUSDC is deposited to your Valu wallet; no Ethereum wallet or gas needed.",
        [
          {
            text: 'Cancel',
            onPress: () => resolveAlert(false),
            style: 'cancel',
          },
          {
            text: 'Got it',
            onPress: async () => {
              try {
                await this.props.dispatch(await saveGeneralSettings({ valuOnrampDisclosureAcceptedV1: true }));
              } catch(e) {
                // Non-fatal if persistence fails; still continue
                console.warn('Failed to persist on-ramp disclosure acceptance', e);
              }
              resolveAlert(true);
              continueToCheckout();
            }
          },
        ],
        { cancelable: true }
      );
      return;
    }

    // Already accepted
    await continueToCheckout();
  }

  validateAmount(value, min, max) {
    if (isNaN(value)) {
      this.setState({ error: " - Please enter a valid number" });
      return false;
    }

    if (Number(value) < Number(min)) {
      this.setState({ error: ` - Min ${min}` });
      return false;
    }

    if (Number(value) > Number(max)) {
      const formattedMax = formatCurrency({ amount: Number(max).toFixed(2), code: 'USD' })[1];
      this.setState({ error: ` - Max ${formattedMax}` });
      return false;
    }

    this.setState({ error: null });
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
        const radioValue = this.state.radioValue;
        const selectedCountry = countryCode || this.state.taxCountry.country;
        
        const valuReply = await ValuProvider.getOnRampOptions({ 
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
            options: valuReply.options,
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
    return (
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        {/* Large You Pay input - no background, very large */}
        <View style={{ width: '90%', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'left' }}>You pay</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start', width: '100%' }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.5}
              style={[styles.extraLargeAmountInline, isSmall ? styles.extraLargeAmountInlineSmall : null]}
            >
              {displayAmount}
              <Text style={[styles.extraLargeCurrencyInline, isSmall ? styles.extraLargeCurrencyInlineSmall : null]}>{`\u2009${this.state.currency}`}</Text>
            </Text>
          </View>
          {this.state.error && (
            <Text style={{ fontSize: 12, color: '#FF6B35', marginTop: 8, textAlign: 'left' }}>
              {this.state.error.replace(' - ', '')}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Fee range and limits display (derived from current options and amount)
  renderFeeAndLimits() {
    return null;
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

  // Demo method for testing attestation flow - Remove in production
  demoAttestationFlow = () => {
    // Create mock transaction data
    const mockTransactionResult = {
      success: true,
      transactionId: "demo_12345"
    };

    // Create mock attestation data
    const mockAttestation = {
      data: "demo_mock_data", // Special flag for demo data
      signer: "VALU"
    };

    const transactionData = {
      amount: this.state.amount,
      currency: this.state.currency,
      received: this.state.converted,
      address: this.state.chosenAddress?.name || 'Your Wallet',
      provider: this.state.options[this.state.radioValue]?.provider || 'Payment Provider'
    };

    // Navigate to attestation acceptance screen
    this.navigateToAttestationAccept(mockAttestation, transactionData);
  };

  render() {
    const { height, width } = Dimensions.get('window');
    const isSmall = height <= 667 || width <= 375;
    const ctaDisabled = this.state.loading || this.state.error != null || this.state.amount === "";
    const allBalances = this.props.allBalances;
    const vusdcId = 'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd';
    const addrId = this.state.chosenAddress?.id;
    const currentBal = addrId && allBalances[vusdcId] && allBalances[vusdcId][addrId] && allBalances[vusdcId][addrId].total
      ? Number(allBalances[vusdcId][addrId].total)
      : 0;
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
              {this.renderOptionsList()}
              
              {/* Spacer to push keypad and button to bottom */}
              <View style={{ flex: isSmall ? 0 : 1 }} />
              
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
                Continue to buy
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
          <Text style={{ fontSize: 13, color: '#666' }}>Receive vUSDC</Text>
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

  // New: Payment options list with payment method, fee %, and total received (sorted by lowest fee)
  renderOptionsList() {
    const { height, width } = Dimensions.get('window');
    const isSmall = height <= 667 || width <= 375;
    const { options, loading } = this.state;

    if (loading) return this.renderSkeletonOptions();
    if (!Array.isArray(options) || options.length === 0) return null;

    const formatNum = (n) => {
      if (n == null) return '—';
      const parts = String(Number(n).toFixed(2)).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    };

    // Sort by lowest fee percentage first
    const sortedOptions = [...options].sort((a, b) => {
      const feeA = Number(a.feePercentage || 0);
      const feeB = Number(b.feePercentage || 0);
      return feeA - feeB;
    });

    // Show max 3 options for better selection
    const visibleOptions = sortedOptions.slice(0, 3);
    const hasMoreOptions = sortedOptions.length > 3;

    return (
      <View style={{ width: '100%', alignItems: 'center', marginTop: 4 }}>
        <View style={{ width: '90%', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 13, color: '#666' }}>Payment options</Text>
          <Text style={{ fontSize: 13, color: '#666' }}>Receive vUSDC</Text>
        </View>
        <View style={styles.optionsContainer}>
          {visibleOptions.map((route, idx) => (
            <View key={`${route.paymentMethod}-${idx}`}>
              <View style={[styles.optionRow3Column, isSmall ? { paddingVertical: 6 } : null]}>
                <Text style={styles.optionMethod}>{route.paymentMethod}</Text>
                <Text style={styles.optionFee}>{`${Number(route.feePercentage || 0).toFixed(1)}%`}</Text>
                <Text style={styles.optionReceive}>{formatNum(route.amountReceived)}</Text>
              </View>
              {idx < visibleOptions.length - 1 && <View style={[styles.optionDivider, isSmall ? { marginVertical: 2 } : null]} />}
            </View>
          ))}
          {hasMoreOptions && (
            <>
              <View style={[styles.optionDivider, isSmall ? { marginVertical: 2 } : null]} />
              <View style={styles.moreOptionsRow}>
                <Text style={styles.moreOptionsText}>{`and ${sortedOptions.length - 3} more option${sortedOptions.length - 3 > 1 ? 's' : ''}`}</Text>
              </View>
            </>
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
  largeInputContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  largeAmountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '600',
    color: '#1A1A1A',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  extraLargeAmountInput: {
    fontSize: 72,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
    minWidth: 200,
  },
  extraLargeAmountInline: {
    fontSize: 72,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
    includeFontPadding: false,
  },
  extraLargeAmountInlineSmall: {
    fontSize: 56,
  },
  currencyLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginLeft: 12,
  },
  extraLargeCurrencyLabel: {
    fontSize: 72,
    fontWeight: '600',
    color: '#888',
    marginLeft: 16,
  },
  extraLargeCurrencyInline: {
    fontSize: 72,
    fontWeight: '500',
    color: '#888',
    includeFontPadding: false,
  },
  extraLargeCurrencyInlineSmall: {
    fontSize: 56,
  },
  smallInputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallAmountText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  smallCurrencyLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#888',
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
    width: '90%',
    paddingVertical: 4,
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

const mapStateToProps = (state) => ({
  activeAccount: state.authentication.activeAccount,
  encryptedPersonalData: state.personal,
  allSubWallets: state.coinMenus.allSubWallets,
  valuService: state.channelStore_valu_service,
  allBalances: state.ledger.balances,
  generalWalletSettings: state.settings.generalWalletSettings,
});

export default connect(mapStateToProps)(ValuOnRampChooseSource);