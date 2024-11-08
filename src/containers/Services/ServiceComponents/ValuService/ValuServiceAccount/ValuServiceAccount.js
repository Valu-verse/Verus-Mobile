import React, { Component } from "react"
import { SafeAreaView, ScrollView, View } from 'react-native'
import { connect } from 'react-redux'
import Store from '../../../../../store/index'
import { setServiceLoading } from "../../../../../actions/actionCreators";
import { createAlert, resolveAlert } from "../../../../../actions/actions/alert/dispatchers/alert";
import { requestSeeds } from "../../../../../utils/auth/authBox";
import { VALU_SERVICE } from "../../../../../utils/constants/intervalConstants";
import { VALU_SERVICE_ID } from "../../../../../utils/constants/services";
import { Text, Button, Portal } from 'react-native-paper'
import { requestServiceStoredData } from "../../../../../utils/auth/authBox";
import ValuOnRamp from "../ValuOnRamp/ValuOnRamp";
import ValuAttestation from "../ValuAttestation/ValuAttestation";
import Styles from "../../../../../styles";
import Colors from '../../../../../globals/colors';

class ValuServiceAccount extends Component {
  constructor(props) {
    super(props);
    this.props.navigation.setOptions({ title: "Valu" });
    this.state = {
      KYCState: null,
      email: null,
      subScreen: this.props.subScreen || null
    }

  }

  componentDidMount() {

    this.initAccountStatus()
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
      return (<ValuOnRamp navigation={this.props.navigation} />);
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
    email: state.channelStore_valu_service.email
  };
};

export default connect(mapStateToProps)(ValuServiceAccount);