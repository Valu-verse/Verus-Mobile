import React from 'react';
import { createStackNavigator } from "@react-navigation/stack";
import { defaultHeaderOptions } from '../../../utils/navigation/header';
import Services from '../../Services/Services'
import Service from '../../Services/Service/Service'
import WyreServiceAccountData from '../../Services/ServiceComponents/WyreService/WyreServiceAccount/WyreServiceAccountData/WyreServiceAccountData';
import WyreServiceAddPaymentMethod from '../../Services/ServiceComponents/WyreService/WyreServiceAccount/WyreServiceAddPaymentMethod/WyreServiceAddPaymentMethod';
import WyreServiceEditPaymentMethod from '../../Services/ServiceComponents/WyreService/WyreServiceAccount/WyreServiceEditPaymentMethod/WyreServiceEditPaymentMethod';
import ViewAttestation from '../../Services/ServiceComponents/AttestationService/ViewAttestation/ViewAttestation';
import ValuAttestation from '../../Services/ServiceComponents/ValuService/ValuAttestation/ValuAttestation';
import ValuOnRampChooseSource from '../../Services/ServiceComponents/ValuService/ValuOnRamp/ValuOnRampChooseSource';
import ValuAttestationAccept from '../../Services/ServiceComponents/ValuService/ValuAttestationAccept/ValuAttestationAccept';
import ValuChooseIdentity from '../../Services/ServiceComponents/ValuService/ValuChooseIdentity/ValuChooseIdentity';
import AddressBook from '../../AddressBook/AddressBook';

const ServicesStack = createStackNavigator();

const ServicesStackScreens = props => {
  return (
    <ServicesStack.Navigator
      screenOptions={defaultHeaderOptions}
    >
      <ServicesStack.Screen
        name="Services"
        component={Services}
        options={{
          title: "Services",
        }}
      />
      <ServicesStack.Screen
        name="Service"
        component={Service}
      />
      <ServicesStack.Screen
        name="WyreServiceAccountData"
        component={WyreServiceAccountData}
      />
      <ServicesStack.Screen
        name="WyreServiceAddPaymentMethod"
        component={WyreServiceAddPaymentMethod}
        options={{
          title: "Connect",
        }}
      />
      <ServicesStack.Screen
        name="WyreServiceEditPaymentMethod"
        component={WyreServiceEditPaymentMethod}
        options={{
          title: "Edit Account",
        }}
      />
      <ServicesStack.Screen
        name="ViewAttestation"
        component={ViewAttestation}
        options={{
          title: "Attestation Details",
        }}
      />
      <ServicesStack.Screen
        name="ValuAttestation"
        component={ValuAttestation}
        options={{
          title: "VALU",
        }}
      />
      <ServicesStack.Screen
        name="ValuOnRampChooseSource"
        component={ValuOnRampChooseSource}
        options={{
          title: "VALU On Ramp",
        }}
      />
      <ServicesStack.Screen
        name="ValuAttestationAccept"
        component={ValuAttestationAccept}
        options={{
          title: "Accept KYC Attestation",
        }}
      />
      <ServicesStack.Screen
        name="ValuChooseIdentity"
        component={ValuChooseIdentity}
        options={{
          title: "Choose Identity",
        }}
      />
      <ServicesStack.Screen
        name="AddressBook"
        component={AddressBook}
        options={{
          title: "Address book",
          headerRight: () => null,
        }}
      />
    </ServicesStack.Navigator>
  );
};

export default ServicesStackScreens