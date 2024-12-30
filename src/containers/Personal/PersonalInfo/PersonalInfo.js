/*
  This component represents the screen the user will
  use to configure their personal wallet profile. They can then
  take this profile data and submit it to applications that require
  KYC if they want.
*/

import { Component } from "react"
import { connect } from 'react-redux'
import { requestPersonalData } from "../../../utils/auth/authBox";
import { PERSONAL_ATTRIBUTES } from "../../../utils/constants/personal";
import { PersonalInfoRender } from "./PersonalInfo.render"
import { primitives } from "verusid-ts-client"
const { IDENTITY_MIDDLENAME, IDENTITY_FIRSTNAME, IDENTITY_LASTNAME, IDENTITY_DATEOFBIRTH } = primitives;

class PersonalInfo extends Component {
  constructor(props) {
    super(props);
    this.state = {
      attributes: {
        [IDENTITY_FIRSTNAME.vdxfid]: "John",
        [IDENTITY_MIDDLENAME.vdxfid]: "",
        [IDENTITY_LASTNAME.vdxfid]: "Doe",
        [IDENTITY_DATEOFBIRTH.vdxfid]: {},
      },
      loading: false
    };
  }

  openAttributes() {
    this.props.navigation.navigate("PersonalAttributes")
  }

  openContact() {
    this.props.navigation.navigate("PersonalContact")
  }

  openImages() {
    this.props.navigation.navigate("PersonalImages")
  }

  openLocations() {
    this.props.navigation.navigate("PersonalLocations")
  }

  openPaymentMethods() {
    this.props.navigation.navigate("PersonalPaymentMethods")
  }

  componentDidUpdate(lastProps) {
    if (lastProps.encryptedAttributes !== this.props.encryptedAttributes) {
      this.loadPersonalAttributes()
    }
  }

  loadPersonalAttributes() {
    this.setState({loading: true}, async () => {
      this.setState({
        attributes: await requestPersonalData(PERSONAL_ATTRIBUTES),
        loading: false
      })
    })
  }

  componentDidMount() {
    this.loadPersonalAttributes()
  }

  render() {
    return PersonalInfoRender.call(this);
  }
}

const mapStateToProps = (state) => {
  return {
    encryptedAttributes: state.personal.attributes
  }
};

export default connect(mapStateToProps)(PersonalInfo);