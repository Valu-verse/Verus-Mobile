/*
  New file: IdentityStackScreens
  - 2026-01-09: Minimal stack for the new Identity bottom tab (placeholder screen).
*/
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import IdentityPlaceholder from '../../Identity/IdentityPlaceholder';

const IdentityStack = createStackNavigator();

const IdentityStackScreens = () => {
  return (
    <IdentityStack.Navigator screenOptions={{ headerShown: false }}>
      <IdentityStack.Screen
        name="IdentityPlaceholder"
        component={IdentityPlaceholder}
      />
    </IdentityStack.Navigator>
  );
};

export default IdentityStackScreens;

