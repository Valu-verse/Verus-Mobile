/*
  SendWizardNavigator
  - Nested stack navigator for the send wizard flow
  - Wraps all wizard screens with SendWizardProvider context
  - Created 2024-12-09
*/

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { SendWizardProvider } from './SendWizardContext';
import SendWizardSelectSource from './SendWizardSelectSource';
import SendWizardSelectTarget from './SendWizardSelectTarget';
import SendWizardAmount from './SendWizardAmount';
import SendWizardRecipient from './SendWizardRecipient';
import SendWizardConfirm from './SendWizardConfirm';
import { defaultHeaderOptions } from '../../utils/navigation/header';

const Stack = createStackNavigator();

const SendWizardNavigator = () => {
  return (
    <SendWizardProvider>
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
      </Stack.Navigator>
    </SendWizardProvider>
  );
};

export default SendWizardNavigator;
