/*
  WalletStackScreens
  - 2025-11-22: Hid the Wallets header so the Home screen can own its chrome.
  - 2025-12-11: Added CoinMenus screen to wallet stack to preserve tab bar visibility
    when viewing asset details.
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
import CoinMenus from '../../Coin/CoinMenus';
import UsdcBridgeScreen from '../../UsdcBridge/UsdcBridgeScreen';
import UsdcBridgeProgressScreen from '../../UsdcBridge/UsdcBridgeProgressScreen';
import VerusToEvmScreen from '../../UsdcBridge/VerusToEvmScreen';
import VerusToEvmProgressScreen from '../../UsdcBridge/VerusToEvmProgressScreen';
import EvmToFiatScreen from '../../UsdcBridge/EvmToFiatScreen';
import EvmToFiatProgressScreen from '../../UsdcBridge/EvmToFiatProgressScreen';

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
        name="CoinMenus" 
        component={CoinMenus} 
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
      <WalletStack.Screen
        name="UsdcBridgeScreen"
        component={UsdcBridgeScreen}
        options={{ title: 'Bridge USDC to Verus', headerBackTitleVisible: false }}
      />
      <WalletStack.Screen
        name="UsdcBridgeProgressScreen"
        component={UsdcBridgeProgressScreen}
        options={{ title: 'Bridge in Progress', headerBackTitleVisible: false }}
      />
      <WalletStack.Screen
        name="VerusToEvmScreen"
        component={VerusToEvmScreen}
        options={{ title: 'Bridge vUSDC to Polygon', headerBackTitleVisible: false }}
      />
      <WalletStack.Screen
        name="VerusToEvmProgressScreen"
        component={VerusToEvmProgressScreen}
        options={{ title: 'Bridge to Polygon: Progress', headerBackTitleVisible: false }}
      />
      <WalletStack.Screen
        name="EvmToFiatScreen"
        component={EvmToFiatScreen}
        options={{ title: 'Cash Out USDC', headerBackTitleVisible: false }}
      />
      <WalletStack.Screen
        name="EvmToFiatProgressScreen"
        component={EvmToFiatProgressScreen}
        options={{ title: 'Cashout Progress', headerBackTitleVisible: false }}
      />
    </WalletStack.Navigator>
  );
};

export default WalletStackScreens