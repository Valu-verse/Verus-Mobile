/*
  SendWizardNavigator
  - Nested stack navigator for the send wizard flow
  - Wraps all wizard screens with SendWizardProvider context
  - Created 2024-12-09
  - Updated 2025-12-11: Added support for initialCoinId and initialSubWalletId params
    to pre-select source when navigating from asset overview screen.
  - Updated 2024-12-15: Added SendWizardSuccess screen
*/

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useRoute } from '@react-navigation/native';
import { SendWizardProvider } from './SendWizardContext';
import SendWizardSelectSource from './SendWizardSelectSource';
import SendWizardSelectTarget from './SendWizardSelectTarget';
import SendWizardAmount from './SendWizardAmount';
import SendWizardRecipient from './SendWizardRecipient';
import SendWizardConfirm from './SendWizardConfirm';
import SendWizardSuccess from './SendWizardSuccess';
import { defaultHeaderOptions } from '../../utils/navigation/header';

const Stack = createStackNavigator();

const SendWizardNavigator = () => {
  const route = useRoute();
  const initialParams = route.params || {};
  
  return (
    <SendWizardProvider initialParams={initialParams}>
      <Stack.Navigator screenOptions={defaultHeaderOptions}>
        <Stack.Screen
          name="SendWizardSelectSource"
          component={SendWizardSelectSource}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardSelectTarget"
          component={SendWizardSelectTarget}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardAmount"
          component={SendWizardAmount}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardRecipient"
          component={SendWizardRecipient}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardConfirm"
          component={SendWizardConfirm}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardSuccess"
          component={SendWizardSuccess}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </SendWizardProvider>
  );
};

export default SendWizardNavigator;
