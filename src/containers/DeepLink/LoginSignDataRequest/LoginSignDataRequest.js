import { Component } from "react"
import { connect } from 'react-redux'
import { createAlert } from "../../../actions/actions/alert/dispatchers/alert"
import { LoginSignDataRequestRender } from "./LoginSignDataRequest.render"
import { primitives } from "verusid-ts-client"
import { Buffer } from 'buffer'
import { setPermissionAgreed } from "../../../actions/actions/deeplink/creators/passthroughData"
import { LOGIN_PERMISSION_TYPES } from "../../../utils/constants/loginPermissions"

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

      // Check if endorsement data was passed directly from LoginRequestInfo
      const passedEndorsement = this.props.route.params?.endorsementData;
      const permissionIndex = this.props.route.params?.permissionIndex;
      
      // Always get the request for redirect URL handling
      const { deeplinkData } = this.props;
      let req = null;
      if (deeplinkData && deeplinkData.challenge) {
        req = new primitives.LoginConsentRequest(deeplinkData);
      }
      
      let endorsement;
      
      if (passedEndorsement) {
        // Use the endorsement data passed from LoginRequestInfo
        endorsement = passedEndorsement;
      } else {
        // Fall back to parsing from deeplink data
        if (!req) {
          throw new Error("Missing endorsement data in state.");
        }

        // Look for endorsement data in the subject array
        const subjectItems = req.challenge.subject?.filter(item => 
          item.vdxfkey === primitives.IDENTITY_SIGNDATA_REQUEST.vdxfid
        ) || [];
        
        const subjectItem = permissionIndex !== undefined 
          ? subjectItems[permissionIndex] 
          : subjectItems[0];

        if (!subjectItem || !subjectItem.data) {
          throw new Error("No endorsement data found in request");
        }

        // Create endorsement object from the base64 data
        endorsement = new primitives.Endorsement();
        endorsement.fromBuffer(Buffer.from(subjectItem.data, 'base64'));
      }

      // Get redirect URL from the request challenge
      let redirectUrl = null;
      if (req && req.challenge.redirect_uris && req.challenge.redirect_uris.length > 0) {
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
    if (this.props.cancel) {
      this.props.cancel()
    }
  }

  handleAccept = () => {
    // Set the permission as agreed using the generic index-based approach
    const permissionIndex = this.props.route.params?.permissionIndex;
    const permissionType = this.props.route.params?.permissionType || LOGIN_PERMISSION_TYPES.SIGN_MESSAGE;
    
    this.props.dispatch(setPermissionAgreed(
      this.props.passthrough, 
      permissionIndex,
      permissionType,
      { endorsementData: this.state.endorsementData }
    ));

    this.props.navigation.goBack();
  }

  handleCancel = () => {
    this.cancel();
  }

  render() {
    return LoginSignDataRequestRender.call(this);
  }
}

const mapStateToProps = (state) => {
  return {
    activeAccount: state.authentication.activeAccount,
    deeplinkData: state.deeplink.data,
    cancel: state.deeplink.cancel,
    passthrough: state.deeplink.passthrough
  }
};

export default connect(mapStateToProps)(LoginSignDataRequest);
