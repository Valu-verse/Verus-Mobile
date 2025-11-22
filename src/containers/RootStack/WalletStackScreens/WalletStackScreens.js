/*
  WalletStackScreens
  - 2025-11-22: Hid the Wallets header so the Home screen can own its chrome.
*/
import React from 'react';
import { createStackNavigator } from "@react-navigation/stack";
import { defaultHeaderOptions } from '../../../utils/navigation/header';
import Home from '../../Home/Home';
import { TouchableOpacity, Text, View } from 'react-native';
import Colors from '../../../globals/colors';
import Service from '../../Services/Service/Service';
import NotificationScreen from '../../Notifications/NotificationScreen';
import ProfileStackScreens from '../ProfileStackScreens/ProfileStackScreens';

const WalletStack = createStackNavigator();

const WalletStackScreens = props => {
  return (
    <WalletStack.Navigator
      screenOptions={defaultHeaderOptions}
    >
      <WalletStack.Screen
        name="Wallets"
        component={Home}
        options={{
          headerShown: false,
        }}
      />
      <WalletStack.Screen
        name="Service"
        component={Service}
      />
      <WalletStack.Screen
        name="PersonalProfileStack"
        component={ProfileStackScreens}
        options={{ headerShown: false }}
      />
      <WalletStack.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          title: "Notifications",
          headerBackTitleVisible: false,
          headerBackTitle: '',
        }}
      />
    </WalletStack.Navigator>
  );
};

export default WalletStackScreens