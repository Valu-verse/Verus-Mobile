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
import ValuProvider from "../../../../../utils/services/ValuProvider";
import { ValuOnRamp as ValuOnRampIcon, VUSDC } from "../../../../../images/customIcons";
import ValuOnRampChooseSource from "../ValuOnRamp/ValuOnRampChooseSource";
import ValuOffRampChooseSource from "../ValuOffRamp/ValuOffRampChooseSource";
import ValuAttestation from "../ValuAttestation/ValuAttestation";
import ValuAttestationAccept from "../ValuAttestationAccept/ValuAttestationAccept";
import ValuOffRampReview from "../ValuOffRamp/ValuOffRampReview";
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';
import { ISO_3166_COUNTRIES } from "../../../../../utils/constants/iso3166";
import ListSelectionModal from "../../../../../components/ListSelectionModal/ListSelectionModal";
import { requestPersonalData } from "../../../../../utils/auth/authBox";
import { PERSONAL_LOCATIONS } from "../../../../../utils/constants/personal";
import { modifyPersonalDataForUser } from "../../../../../actions/actionDispatchers";
import BuySellSheet from "../BuySellSheet/BuySellSheet";

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
      subScreenData: null,
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
      console.log("Checking Valu account creation status");
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
    this.countrySelectionInProgress = true; // Flag to prevent cancel logic
    this.setState({
        taxCountry: {
            ...this.state.taxCountry,
            country: countryCode
        },
        countryModalOpen: false
    }, () => {
        this.updateTaxCountry();
        setTimeout(() => {
            this.countrySelectionInProgress = false; // Reset flag after a short delay
        }, 100);
    })
}

loadPersonalLocations() {
    this.setState({ loading: true }, async () => {
        const location = await requestPersonalData(PERSONAL_LOCATIONS);

        const taxCountries = location?.tax_countries ? location?.tax_countries[0] : null;
        if (!taxCountries?.country) {
            this.setState({ countryModalOpen: true });
        }
        this.setState({
            locations: location,
            taxCountry: location?.tax_countries ? location?.tax_countries[0] :  [],
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
    if (!this.props.valuAuthenticated) {
      console.log("Authenticating Valu service account");
      const seed = (await requestSeeds())[VALU_SERVICE];
      if (seed == null) throw new Error("No Valu seed present");
      await ValuProvider.authenticate(seed);
    }
  }

  setSubScreen = (subScreen, additionalData = null) => {
    this.setState({ 
      subScreen,
      subScreenData: additionalData 
    });
  };

  render() {

    if(!this.props.valuAuthenticated) {
      console.log("Valu service account is not authenticated");
      return null;
    }

    if (this.state.subScreen == "attestation")
      return (<ValuAttestation {...this.props} />);
    if (this.state.subScreen == "ValuOffRampReview")
      return (<ValuOffRampReview {...this.props} />);
    else if (this.state.subScreen == "onOffRamp")
      return (
        <SafeAreaView style={Styles.defaultRoot}>
            <ScrollView
                style={Styles.fullWidth}
                contentContainerStyle={Styles.focalCenter}>
                <Portal>
                    { /* Render a bottom-sheet stepper instead of inline controls */ }
                    <BuySellSheet
                      visible={true}
                      onClose={() => this.props.navigation.goBack()}
                      onComplete={({ action, address }) => {
                        // Persist chosen address and transition
                        this.setState({ subScreenData: { initialAddress: address } }, () => {
                          this.setSubScreen(action === 'sell' ? 'offRamp' : 'onRamp');
                        });
                      }}
                    />
                </Portal>
                <View style={{ alignContent: 'center', alignItems: 'center', width: 380 }} />
            </ScrollView>
        </SafeAreaView>);
    else if (this.state.subScreen == "onRamp")
      return (<ValuOnRampChooseSource 
        {...this.props}
        setSubScreen={this.setSubScreen}
        initialAddress={this.state.subScreenData?.initialAddress}
      />);
    else if (this.state.subScreen == "offRamp")
      return (<ValuOffRampChooseSource {...this.props} initialAddress={this.state.subScreenData?.initialAddress}/>);
    else if (this.state.subScreen == "attestationAccept")
      return (<ValuAttestationAccept 
        {...this.props}
        route={{ params: this.state.subScreenData || {} }}
        setSubScreen={this.setSubScreen}
      />);   
  }

}

const mapStateToProps = (state) => {

  return {
    hasValuAccount: state.channelStore_valu_service.accountId != null,
    KYCState: state.channelStore_valu_service.KYCState,
    valuAuthenticated: state.channelStore_valu_service.authenticated,
    email: state.channelStore_valu_service.email,
    activeAccount: state.authentication.activeAccount,
    encryptedPersonalData: state.personal,
  };
};

export default connect(mapStateToProps)(ValuServiceAccount);