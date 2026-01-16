/*
  IdentityStackScreens
  - 2026-01-09: Minimal stack for the new Identity bottom tab.
  - 2026-01-12: Updated to use IdentityHome (redesigned grid layout).
*/
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import IdentityHome from '../../Identity/Home/IdentityHome';

const IdentityStack = createStackNavigator();

const IdentityStackScreens = () => {
  return (
    <IdentityStack.Navigator screenOptions={{ headerShown: false }}>
      <IdentityStack.Screen
        name="IdentityHome"
        component={IdentityHome}
      />
    </IdentityStack.Navigator>
  );
};

export default IdentityStackScreens;
