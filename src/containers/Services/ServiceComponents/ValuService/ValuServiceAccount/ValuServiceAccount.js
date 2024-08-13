import React, { Component } from "react"
import { connect } from 'react-redux'
import Store from '../../../../../store/index'
import { setServiceLoading } from "../../../../../actions/actionCreators";
import { createAlert, resolveAlert } from "../../../../../actions/actions/alert/dispatchers/alert";
import { requestSeeds } from "../../../../../utils/auth/authBox";
import { VALU_SERVICE } from "../../../../../utils/constants/intervalConstants";
import { VALU_SERVICE_ID } from "../../../../../utils/constants/services";
import { Text, Button, Portal } from 'react-native-paper'
import { requestServiceStoredData } from "../../../../../utils/auth/authBox";

class ValuServiceAccount extends Component {
  constructor(props) {
    super(props);
    this.props.navigation.setOptions({ title: "Valu" });
    this.state = {
      KYCState: null,
      email: null
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
    const serviceData = await requestServiceStoredData(VALU_SERVICE_ID);
    console.log("serviced data",serviceData )

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

  render() {

    //if (this.props.KYCState == null)
    return  (<></>);
    // else if (this.props.KYCState == 9)
    //   return (<ValuServiceAccountOverview navigation={this.props.navigation}/>)
    // else if (this.props.KYCState > 0) 
    //   return (<KYCInfoScreen navigation={this.props.navigation} />)
    // else 
    //   return (<PrimeTrustAccountCreator navigation={this.props.navigation} />)

  }

}

const mapStateToProps = (state) => {
  return {
    hasValuAccount: state.channelStore_primetrust_service.accountId != null,
    KYCState: state.channelStore_primetrust_service.KYCState,
    valuAuthenticated: state.channelStore_primetrust_service.authenticated,
    email: state.channelStore_primetrust_service.email
  };
};

export default connect(mapStateToProps)(ValuServiceAccount);