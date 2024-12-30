import React, { Component } from "react"
import { SafeAreaView, ScrollView, View, Image } from 'react-native'
import { connect } from 'react-redux'
import { List, Button, Text, Portal } from 'react-native-paper';
import Store from '../../../../../store/index'
import { setServiceLoading } from "../../../../../actions/actionCreators";
import { createAlert, resolveAlert } from "../../../../../actions/actions/alert/dispatchers/alert";
import { requestSeeds } from "../../../../../utils/auth/authBox";
import { VALU_SERVICE } from "../../../../../utils/constants/intervalConstants";
import { VALU_SERVICE_ID } from "../../../../../utils/constants/services";
import { requestServiceStoredData } from "../../../../../utils/auth/authBox";
import { ValuOnRamp as ValuOnRampIcon, VUSDC } from "../../../../../images/customIcons";
import ValuOnRampChooseSource from "../ValuOnRamp/ValuOnRampChooseSource";
import ValuAttestation from "../ValuAttestation/ValuAttestation";
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { ISO_3166_COUNTRIES } from "../../../../../utils/constants/iso3166";
import ListSelectionModal from "../../../../../components/ListSelectionModal/ListSelectionModal";
import { requestPersonalData } from "../../../../../utils/auth/authBox";
import { PERSONAL_LOCATIONS } from "../../../../../utils/constants/personal";
import { modifyPersonalDataForUser } from "../../../../../actions/actionDispatchers";

const ALLOWED_COUNTRIES = ["US", "CA", "GB", "AT", // Austria
  "BE", // Belgium
  //"BG", // Bulgaria
  "CY", // Cyprus
  "CZ", // Czech Republic
//  "DK", // Denmark
  "EE", // Estonia
  "FI", // Finland
  "FR", // France
  "DE", // Germany
  "GR", // Greece
//  "HU", // Hungary
  "IE", // Ireland
  "IT", // Italy
  "LV", // Latvia
  "LT", // Lithuania
  "LU", // Luxembourg
  "MT", // Malta
  "NL", // Netherlands
//  "PL", // Poland
  "PT", // Portugal
  "RO", // Romania
  "SK", // Slovakia
  "SI", // Slovenia
  "ES", // Spain
//  "SE"  // Sweden
];
class ValuServiceAccount extends Component {
  constructor(props) {
    super(props);
    this.props.navigation.setOptions({ title: "Valu" });
    this.state = {
      KYCState: null,
      email: null,
      subScreen: this.props.subScreen || null,
      attestationData: {},
      signer: "",
      taxCountry: null,
      countryModalOpen: false,
      address: {},
      locations: {},
      loading: false,
    }

  }

  componentDidMount() {

    this.initAccountStatus()
    this.loadPersonalLocations();
  }

  initAccountStatus = async () => {
    this.props.dispatch(setServiceLoading(true, VALU_SERVICE_ID))

    try {
      await this.checkAccountCreationStatus();
      this.props.dispatch(setServiceLoading(false, VALU_SERVICE_ID))
    } catch (e) {
      console.warn(e)

      createAlert(
        "Error",
        "Failed to retrieve Valu account status from server.",
        [
          {
            text: "Try again",
            onPress: async () => {
              await this.initAccountStatus()
              resolveAlert()
            }
          },
          { text: "Ok", onPress: () => resolveAlert() },
        ]
      );
    }
  };

  selectCountry(countryCode) {
    this.setState({
        taxCountry: {
            ...this.state.taxCountry,
            country: countryCode
        }
    }, () => this.updateTaxCountry())
}

loadPersonalLocations() {
    this.setState({ loading: true }, async () => {
        const location = await requestPersonalData(PERSONAL_LOCATIONS);
        this.setState({
            locations: location,
            taxCountry: location.tax_countries[0] || [],
            loading: false,
        });

        
    });
}

updateTaxCountry() {
    this.setState({ loading: true }, async () => {
        let taxCountries = this.state.locations.tax_countries

        taxCountries = [this.state.taxCountry]

        await modifyPersonalDataForUser(
            { ...this.state.locations, tax_countries: taxCountries },
            PERSONAL_LOCATIONS,
            this.props.activeAccount.accountHash
        );

        this.setState({
            loading: false
        });
    })
}

  async checkAccountCreationStatus() {
 //   const serviceData = await requestServiceStoredData(VALU_SERVICE_ID);
   // console.log("serviced data", serviceData)

    // if (serviceData?.KYCState) {
    //    this.props.dispatch(setPrimeTrustAccountStage(serviceData?.KYCState));
    //  } else {
    //   this.props.dispatch(setPrimeTrustAccountStage(0));
    //  }


    // if(serviceData?.loginDetails) {
    //     console.log("serviceData?.loginDetails as: ", serviceData?.loginDetails); 
    //     const {success} = await PrimeTrustProvider.authenticate(serviceData.loginDetails.accountID);
    //     console.log("success: ", success); 
    //     if (success) {
    //       if (serviceData.loginDetails?.accountId)
    //       this.props.dispatch(setPrimeTrustAccount({accountId: serviceData.loginDetails.accountId, KYCState: serviceData.KYCState || 0 }));
    //     }
    //    // this.props.dispatch(setPrimeTrustAccount({accountId: authenticatedAs, KYCState: serviceData.KYCState || 0 }));
    //   }

  }

  setSubScreen = (subScreen) => {

    this.setState({ subScreen });
  };

  render() {

    if (this.state.subScreen == "attestation")
      return (<ValuAttestation props={this.props} />);
    else if (this.state.subScreen == "onOffRamp")
      return (
        <SafeAreaView style={Styles.defaultRoot}>
            <ScrollView
                style={Styles.fullWidth}
                contentContainerStyle={Styles.focalCenter}>
                <Portal>

                    {this.state.countryModalOpen && (
                        <ListSelectionModal
                            title="Select a Country"
                            flexHeight={3}
                            visible={this.state.countryModalOpen}
                            onSelect={(item) => this.selectCountry(item.key)}
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
                </Portal>


                <View style={{ alignContent: 'center', alignItems: 'center', width: 380 }}>
                    <Text style={{ fontSize: 25, textAlign: 'center', paddingBottom: 20 }}>
                        Valu On-Off Ramp
                    </Text>
                    <Image source={ValuOnRampIcon} style={{ aspectRatio: 2, height: 120, alignSelf: 'center', marginBottom: 1 }} />
                    <Text style={{ fontSize: 20, textAlign: 'center', paddingTop: 20, marginHorizontal: 10 }}>
                        Purchase or sell vUSDC tokens on Verus to/from your bank account or credit/debit card.
                    </Text>
                    <Image source={VUSDC} style={{ aspectRatio: 1.1, height: 80, alignSelf: 'center', marginTop: 50 }} />
                    <Text style={{ fontSize: 20, textAlign: 'center', paddingBottom: 20 }}>
                        vUSDC
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 6, width: '100%' }}>
                        <Button
                            onPress={() => { this.setSubScreen("onRamp") }}
                            uppercase={false}
                            mode="contained"
                            disabled={this.state.taxCountry == null}
                            labelStyle={{ fontWeight: 'bold', fontSize: 16 }}
                            style={{ height: 41, width: 125 }}
                        >
                            {'Buy Crypto'}
                        </Button>

                        <Button
                            onPress={() => { /* Your second button action */ }}
                            uppercase={false}
                            mode="contained"
                            labelStyle={{ fontWeight: 'bold', fontSize: 16 }}
                            style={{ height: 41, width: 125 }}
                        >
                            {'Sell Crypto'}
                        </Button>
                    </View>
                    <React.Fragment >
                        <List.Subheader>{"Country"}</List.Subheader>
                        <List.Item
                            style={{ width: 200, borderColor: "black", borderWidth: 1, borderRadius: 5, marginBottom: 10 }}
                            title={
                                ISO_3166_COUNTRIES[this.state.taxCountry?.country] == null
                                    ? "Select a country"
                                    : `${ISO_3166_COUNTRIES[this.state.taxCountry.country].emoji} ${ISO_3166_COUNTRIES[this.state.taxCountry.country].name
                                    }`
                            }
                            titleStyle={{
                                color: "black"
                            }}
                            right={(props) => (
                                <List.Icon {...props} icon={"flag"} size={20} />
                            )}
                            onPress={
                                this.state.loading
                                    ? () => { }
                                    : () => this.setState({ countryModalOpen: true })
                            }
                        />
                    </React.Fragment>
                </View>
            </ScrollView>
        </SafeAreaView>);
    else if (this.state.subScreen == "onRamp")
      return (<ValuOnRampChooseSource navigation={this.props.navigation} props={this.props}/>);
    else
      return (
        <SafeAreaView style={Styles.defaultRoot}>
          <ScrollView
            style={Styles.fullWidth}
            contentContainerStyle={Styles.focalCenter}>
            <Text style={styles.title}>Select an Option</Text>
            <Button
              style={{marginTop:40}}
              color={Colors.primaryColor}
              mode="contained"
              onPress={() => this.setSubScreen("attestation")}
            >
              Valu Attestations
            </Button>
            <Button
              color={Colors.primaryColor}
              mode="contained"
              onPress={() => this.setSubScreen("onOffRamp")}
              style={{marginTop:40}}
            >
              Valu OnRamp
            </Button>
            <Button
              color={Colors.primaryColor}
              mode="contained"
              onPress={() => this.setSubScreen("onRamp")}
              style={{marginTop:40}}
            >
              Valu OffRamp
            </Button>
          </ScrollView>
        </SafeAreaView>
      );
  }

}

const mapStateToProps = (state) => {

  return {
    hasValuAccount: state.channelStore_valu_service.accountId != null,
    KYCState: state.channelStore_valu_service.KYCState,
    valuAuthenticated: state.channelStore_valu_service.authenticated,
    email: state.channelStore_valu_service.email,
    activeAccount: state.authentication.activeAccount,
    encryptedPersonalData: state.personal
  };
};

export default connect(mapStateToProps)(ValuServiceAccount);