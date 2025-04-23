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
  TouchableOpacity 
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
      chosenAddress: addresses[0] || {},
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
    createAlert(
      "Terms and Conditions",
      "By proceeding with this transaction, you acknowledge and agree that the Polygon tokens you are purchasing will be automatically converted into vUSDC. \n\nThis conversion is conducted on a 1:1 basis and is required to facilitate seamless transactions within our platform.\n\nFor more details, please review our [Terms & Conditions] and/or [FAQ] section.",
      [
        {
          text: 'Cancel',
          onPress: () => resolveAlert(false),
          style: 'cancel',
        },
        {
          text: 'Accept & Proceed', 
          onPress: async () => {
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
              resolveAlert(true);
            } catch (error) {
              console.error("Error starting on-ramp:", error);
              Alert.alert("Error", "Failed to start the purchase process. Please try again.");
              resolveAlert(false);
            }
          }
        },
      ],
      { cancelable: true }
    );
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
    const youPay = value || this.state.amount;

    if (youPay.includes('.') && youPay.split('.')[1].length > 2) {
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
    return (
      <>
        <TextInput
          style={styles.textInput}
          mode="outlined"
          value={this.state.amount}
          right={<TextInput.Affix text={this.state.currency} />}
          onChangeText={this.handleChange}
          keyboardType="numeric"
          label={`You Pay${this.state.error || ""}`}
          error={this.state.error != null}
        />
        
        <TextInput
          style={[styles.textInput, { marginTop: 20 }]}
          mode="outlined"
          placeholder={`Enter amount in ${this.state.currency}`}
          value={this.state.loading ? "-" : String(this.state.converted)}
          right={<TextInput.Affix text={"vUSDC"} />}
          onChangeText={() => {}}
          keyboardType="numeric"
          label={`You Receive${this.state.error || ""}`}
          error={this.state.error != null}
        />
      </>
    );
  }

  renderAddressSelector() {
    return (
      <View style={{ marginTop: 20, width: 300 }}>
        <Text style={{ fontSize: 14, marginBottom: 5 }}>Select Receiving Address</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={this.openAddressModal}
          style={{ width: '100%' }}
        >
          <TextInput
            style={[styles.textInput, { height: 35, fontSize: 15 }]}
            mode="outlined"
            value={this.state.chosenAddress?.name || "Select an address"}
            right={<TextInput.Icon icon="menu-down" size={20} />}
            editable={false}
            pointerEvents="none"
            label={`To the ${this.state.mainVerusNetwork} Network`}
          />
        </TouchableOpacity>
      </View>
    );
  }

  renderPaymentMethodSelector() {
    const feeoptions = "Please select the payment method you would like to use to purchase vUSDC tokens. \n\n" +
      "Polygon: We use the Polygon network to provide the cheapest on-ramp prices.\n";
      
    return (
      <View style={{ alignContent: 'center', alignItems: 'center' }}>
        <List.Section title=" " style={{ width: 380, marginTop: -30, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 40 }}>
            <Text>Choose Payment Method</Text>
            <IconButton
              icon="information"
              size={25}
              iconColor={Colors.verusGreenColor}
              onPress={() => Alert.alert("Purchase Options", feeoptions)}
            />
          </View>
          
          <View style={{ maxHeight: 300 }}>
            <ScrollView style={{ flexGrow: 0 }}>
              {(this.state.loading && !this.state.updatingfee) ? (
                <ActivityIndicator 
                  animating={true}
                  size={100}
                  style={styles.loadingIndicator} 
                />
              ) : (
                <RadioButton.Group
                  value={this.state.radioValue}
                  onValueChange={(value) => {
                    this.setState({ radioValue: value }, 
                      () => this.handleChange(this.state.amount)
                    );
                  }}
                >
                  <View style={[styles.tableRow, { marginRight: 20 }]}>
                    <Text style={[styles.tableHeaderCell, { flex: 4 }]}>Method</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 4 }]}>via</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Fee</Text>
                  </View>
                  
                  {this.state.options.map((route, index) => (
                    <View key={index} style={[styles.tableRow, { marginRight: 20 }]}>
                      <View style={[styles.tableCell, { flex: 4 }]}>
                        <Text style={styles.tableCellLabel}>
                          {route.provider || 'Payment Provider'}
                        </Text>
                        <Text style={styles.tableCellValue}>
                          {route.paymentMethod}
                        </Text>
                      </View>

                      <View style={[styles.tableCell, { flex: 4 }]}>
                        <Text style={styles.tableCellLabel}>
                          {route.destinationNetworkName}
                        </Text>
                        <Text style={styles.tableCellValue}>
                          {route.destinationCurrency.toUpperCase()}
                        </Text>
                      </View>
                      
                      <View style={[styles.tableCell, { flex: 2 }]}>
                        {this.state.updatingfee ? (
                          <ActivityIndicator 
                            animating={true} 
                            color='#aaa' 
                            size={20} 
                            style={{ flex: 3 }} 
                          />
                        ) : (
                          <Text style={{ textAlign: "left" }}>
                            {`${route.feePercentage}%`}
                          </Text>
                        )}
                      </View>
                      
                      <RadioButton value={index} style={{ flex: 1 }} />
                    </View>
                  ))}
                </RadioButton.Group>
              )}
            </ScrollView>
          </View>
        </List.Section>
        
        <Text style={{ color: '#888' }}>
          {`Total fee ${this.state.loading ? "-" : isNaN(this.state.totalFee) ? 0 : this.state.totalFee} ${this.state.currency}`}
        </Text>
      </View>
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
    return (
      <SafeAreaView style={Styles.defaultRoot}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
            {this.renderModals()}
            
            <Text style={styles.headerText}>Buy Crypto</Text>
            
            {this.renderCurrencyInputs()}
            {this.renderAddressSelector()}
            {this.renderPaymentMethodSelector()}
            
            <Button
              onPress={this.startOnRamp}
              uppercase={false}
              mode="contained"
              disabled={this.state.loading || this.state.error != null}
              labelStyle={styles.buttonLabel}
              style={styles.actionButton}
            >
              Buy vUSDC
            </Button>
            
            <React.Fragment>
              <Divider style={{ marginVertical: 5 }} />
              <List.Item
                style={styles.countrySelector}
                title={
                  ISO_3166_COUNTRIES[this.state.taxCountry?.country] == null
                    ? "Select a country"
                    : `${ISO_3166_COUNTRIES[this.state.taxCountry.country].emoji} ${ISO_3166_COUNTRIES[this.state.taxCountry.country].name}`
                }
                titleStyle={{ color: "black" }}
                right={(props) => (
                  <List.Icon {...props} icon={"account-edit"} size={20} />
                )}
                onPress={
                  this.state.loading
                    ? () => {}
                    : () => this.setState({ countryModalOpen: true })
                }
              />
            </React.Fragment>
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
  valuService: state.channelStore_valu_service
});

export default connect(mapStateToProps)(ValuOnRampChooseSource);