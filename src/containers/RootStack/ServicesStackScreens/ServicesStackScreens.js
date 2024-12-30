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
    </ServicesStack.Navigator>
  );
};

export default ServicesStackScreens