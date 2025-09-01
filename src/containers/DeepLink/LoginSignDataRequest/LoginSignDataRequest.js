import { Component } from "react"
import { connect } from 'react-redux'
import { createAlert } from "../../../actions/actions/alert/dispatchers/alert"
import { LoginSignDataRequestRender } from "./LoginSignDataRequest.render"
import { primitives } from "verusid-ts-client"
import { Buffer } from 'buffer'

class LoginSignDataRequest extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      ready: false,
      signerFqn: this.props.route.params.signerFqn,
      endorsementDetails: null,
      endorsementData: null
    };
  }

  componentDidMount() {
    this.processEndorsementData();
  }

  processEndorsementData = async () => {
    try {
      this.setState({ loading: true });

      const { deeplinkData } = this.props.route.params;
      const req = new primitives.LoginConsentRequest(deeplinkData);

      // Look for endorsement data in the subject array
      const subjectItem = req.challenge.subject.find(item => 
        item.vdxfkey === primitives.IDENTITY_SIGNDATA_REQUEST.vdxfid
      );

      if (!subjectItem || !subjectItem.data) {
        throw new Error("No endorsement data found in request");
      }

      // Create endorsement object from the base64 data
      const endorsement = new primitives.Endorsement();
      endorsement.fromBuffer(Buffer.from(subjectItem.data, 'base64'));

      // Get redirect URL from the request challenge
      let redirectUrl = null;
      if (req.challenge.redirect_uris && req.challenge.redirect_uris.length > 0) {
        const redirectsObj = {};
        req.challenge.redirect_uris.forEach(a => {
          redirectsObj[a.vdxfkey] = a;
        });
        const redirectInfo = redirectsObj[primitives.LOGIN_CONSENT_WEBHOOK_VDXF_KEY.vdxfid];
        if (redirectInfo && redirectInfo.uri) {
          redirectUrl = redirectInfo.uri;
        }
      }

      // Format endorsement details for display
      const endorsementDetails = {
        version: endorsement.version,
        endorsee: endorsement.endorsee,
        message: endorsement.message,
        reference: endorsement.reference ? endorsement.reference.toString('hex') : null,
        txid: endorsement.txid ? endorsement.txid.toString('hex') : null,
        redirectUrl: redirectUrl
      };

      this.setState({
        endorsementDetails,
        endorsementData: endorsement,
        ready: true,
        loading: false
      });      

    } catch (error) {
      console.error('Error processing endorsement data:', error);
      createAlert("Error", `Failed to process endorsement data: ${error.message}`);
      this.setState({ loading: false });
      this.cancel();
    }
  }

  cancel = () => {
    if (this.props.route.params.cancel) {
      this.props.route.params.cancel.cancel()
    }
  }

  handleAccept = () => {
    // Pass the endorsement data back to continue with signing
    if (this.props.route.params.onGoBack) {
      this.props.route.params.onGoBack({
        accepted: true,
        endorsementData: this.state.endorsementData
      });
    }
    this.props.navigation.goBack();
  }

  handleCancel = () => {
    if (this.props.route.params.onGoBack) {
      this.props.route.params.onGoBack({
        accepted: false
      });
    }
    this.cancel();
  }

  render() {
    return LoginSignDataRequestRender.call(this);
  }
}

const mapStateToProps = (state) => {
  return {
    activeAccount: state.authentication.activeAccount
  }
};

export default connect(mapStateToProps)(LoginSignDataRequest);
