import React, { Component } from "react"
import { connect } from 'react-redux'
import { VALU_SERVICE_ID } from "../../../../utils/constants/services";
import { VALU_SERVICE} from "../../../../utils/constants/intervalConstants"
import { ValuServiceRender } from "./ValuService.render";
import { requestSeeds } from "../../../../utils/auth/authBox";
import { initiatePartnerUserId } from "../../../../actions/actions/channels/valu/dispatchers/ValuWalletReduxManager";

class ValuService extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      subScreen: this.props.subScreen || null,
      subScreenData: this.props.subScreenData || null
    }
    this.props.navigation.setOptions({ title: "VALU" })
  }

  async componentDidMount() {
    if (this.props.valuService.partnerUserId == undefined) {
      const seed = (await requestSeeds())[VALU_SERVICE];
      if (seed == null) throw new Error('No Valu seed present');
        await initiatePartnerUserId(seed);
    }
  }

  render() {
    return ValuServiceRender.call(this)
  }
}

const mapStateToProps = (state) => {
  // console.log(state.channelStore_valu_service)
  return {
    encryptedSeeds: state.authentication.activeAccount.seeds,
    loading: state.services.loading[VALU_SERVICE_ID],
    valuService: state.channelStore_valu_service
  }
};

export default connect(mapStateToProps)(ValuService);