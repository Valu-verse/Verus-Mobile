/*
  New file: ActivityStackScreens
  - Minimal stack for the Activity tab (transaction history placeholder)
*/
import React from 'react';
import { createStackNavigator } from "@react-navigation/stack";
import { defaultHeaderOptions } from '../../../utils/navigation/header';
import Activity from '../../activity/Activity';

const ActivityStack = createStackNavigator();

const ActivityStackScreens = () => {
  return (
    <ActivityStack.Navigator screenOptions={defaultHeaderOptions}>
      <ActivityStack.Screen
        name="Activity"
        component={Activity}
        options={{ title: 'Activity' }}
      />
    </ActivityStack.Navigator>
  );
};

export default ActivityStackScreens;


