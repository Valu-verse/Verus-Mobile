import { NavigationActions } from "@react-navigation/compat";
import { Component } from "react"
import { connect } from 'react-redux'
import { modifyPersonalDataForUser } from "../../../../actions/actionDispatchers";
import { createAlert, resolveAlert } from "../../../../actions/actions/alert/dispatchers/alert";
import { PERSONAL_LOCATIONS } from "../../../../utils/constants/personal";
import { provideCustomBackButton } from "../../../../utils/navigation/customBack";
import { PersonalLocationsEditAddressRender } from "./PersonalLocationsEditAddress.render"
import { primitives } from "verusid-ts-client"
const { IDENTITY_HOMEADDRESS_STREET1, IDENTITY_HOMEADDRESS_STREET2, IDENTITY_HOMEADDRESS_CITY, IDENTITY_HOMEADDRESS_REGION, IDENTITY_HOMEADDRESS_POSTCODE, IDENTITY_HOMEADDRESS_COUNTRY } = primitives;

class PersonalLocationsEditAddress extends Component {
  constructor(props) {
    super(props);
    const initialAddress =
      props.route.params.index != null &&
      props.route.params.locations.physical_addresses[
        props.route.params.index
      ] != null
        ? props.route.params.locations.physical_addresses[
            props.route.params.index
          ]
        : {
            [IDENTITY_HOMEADDRESS_STREET1.vdxfid]: "",
            [IDENTITY_HOMEADDRESS_STREET2.vdxfid]: "",
            [IDENTITY_HOMEADDRESS_CITY.vdxfid]: "",
            [IDENTITY_HOMEADDRESS_REGION.vdxfid]: "",
            [IDENTITY_HOMEADDRESS_POSTCODE.vdxfid]: "",
            [IDENTITY_HOMEADDRESS_COUNTRY.vdxfid]: "",
          };

    this.state = {
      locations: props.route.params.locations,
      address: initialAddress,
      currentTextInputModal: null,
      loading: false,
      countryModalOpen: false,
      index: props.route.params.index
    };

    this.addressTextInputLabels = {
      [IDENTITY_HOMEADDRESS_STREET1.vdxfid]: {
        title: "Address line 1",
        description: "Street address, company name, P.O. box",
        placeholder: "required"
      },
      [IDENTITY_HOMEADDRESS_STREET2.vdxfid]: {
        title: "Address line 2",
        description: "Apartment number, unit, floor, etc.",
        placeholder: "optional"
      },
      [IDENTITY_HOMEADDRESS_CITY.vdxfid]: {
        title: "City",
        placeholder: "required"
      },
      [IDENTITY_HOMEADDRESS_REGION.vdxfid]: {
        title: "State/Province/Region",
        placeholder: "optional"
      },
      [IDENTITY_HOMEADDRESS_POSTCODE.vdxfid]: {
        title: "ZIP/Postal Code",
        placeholder: "required"
      }
    }
    const sdf =324
  }

  componentDidMount() {
    if (this.props.route.params != null && this.props.route.params.customBack != null) {
      provideCustomBackButton(
        this,
        this.props.route.params.customBack.route,
        this.props.route.params.customBack.params
      );
    }
  }

  updateAddress() {
    this.setState({ loading: true }, async () => {
      let addresses = this.state.locations.physical_addresses
      
      if (addresses == null) {
        addresses = [this.state.address]
      } else if (this.state.index == null) {
        addresses.push(this.state.address)
      } else {
        addresses[this.state.index] = this.state.address
      }

      await modifyPersonalDataForUser(
        {...this.state.locations, physical_addresses: addresses},
        PERSONAL_LOCATIONS,
        this.props.activeAccount.accountHash
      );

      this.setState({
        loading: false,
        index:
          this.state.locations.physical_addresses == null
            ? 0
            : this.state.index == null
            ? this.state.locations.physical_addresses.length - 1
            : this.state.index,
      });
    })
  }

  tryDeleteAddress() {
    createAlert(
      'Delete address?',
      'Are you sure you would like to remove this address from your personal profile?',
      [
        {text: 'No', onPress: () => {
          resolveAlert()
        }},
        {text: 'Yes', onPress: () => {
          this.deleteAddress()
          resolveAlert()
        }},
      ],
      {
        cancelable: false,
      },
    )
  }

  deleteAddress() {
    this.setState({ loading: true }, async () => {
      if (this.state.index != null) {
        let addresses = this.state.locations.physical_addresses
        addresses.splice(this.state.index, 1);
  
        await modifyPersonalDataForUser(
          {...this.state.locations, physical_addresses: addresses},
          PERSONAL_LOCATIONS,
          this.props.activeAccount.accountHash
        );
      }

      this.props.navigation.dispatch(NavigationActions.back())
    })
  }

  selectCountry(countryCode) {
    this.setState({
      address: {
        ...this.state.address,
        [IDENTITY_HOMEADDRESS_COUNTRY.vdxfid]: countryCode
      }
    }, () => this.updateAddress())
  }

  closeTextInputModal() {
    this.setState({currentTextInputModal: null}, () => {
      this.updateAddress()
    })
  }

  render() {
    return PersonalLocationsEditAddressRender.call(this);
  }
}

const mapStateToProps = (state) => {
  return {
    activeAccount: state.authentication.activeAccount,
  }
};

export default connect(mapStateToProps)(PersonalLocationsEditAddress);