/*
  2025-11-22: Added SettingsStackScreens to host Settings routes for the
  dedicated bottom tab without relying on the deprecated side drawer.
*/
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { defaultHeaderOptions } from '../../../utils/navigation/header';
import SettingsMenus from '../../Settings/SettingsMenus';
import ProfileSettings from '../../Settings/ProfileSettings/ProfileSettings';
import WalletSettings from '../../Settings/WalletSettings/WalletSettings';
import AppInfo from '../../Settings/AppInfo/AppInfo';
import ProfileInfo from '../../Settings/ProfileSettings/ProfileInfo/ProfileInfo';
import ResetPwd from '../../Settings/ProfileSettings/ResetPwd/ResetPwd';
import RecoverSeed from '../../Settings/ProfileSettings/RecoverSeed/RecoverSeed';
import GeneralWalletSettings from '../../Settings/WalletSettings/GeneralWalletSettings/GeneralWalletSettings';
import CoinSettings from '../../Settings/WalletSettings/CoinSettings/CoinSettings';
import DeleteProfile from '../../Settings/ProfileSettings/DeleteProfile/DeleteProfile';
import AddressBlocklist from '../../Settings/WalletSettings/AddressBlocklist/AddressBlocklist';
import VrpcOverrides from '../../Settings/WalletSettings/VrpcOverrides/VrpcOverrides';
import SecureLoading from '../../SecureLoading/SecureLoading';
import DisplaySeed from '../../DisplaySeed/DisplaySeed';

const SettingsStack = createStackNavigator();

const SettingsStackScreens = () => {
  return (
    <SettingsStack.Navigator screenOptions={defaultHeaderOptions}>
      <SettingsStack.Screen
        name="SettingsMenus"
        component={SettingsMenus}
        options={{ title: 'Settings' }}
      />
      <SettingsStack.Screen
        name="ProfileSettings"
        component={ProfileSettings}
        options={{ title: 'Profile' }}
      />
      <SettingsStack.Screen
        name="WalletSettings"
        component={WalletSettings}
        options={{ title: 'Wallet' }}
      />
      <SettingsStack.Screen
        name="AppInfo"
        component={AppInfo}
        options={{ title: 'App info' }}
      />
      <SettingsStack.Screen
        name="ProfileInfo"
        component={ProfileInfo}
        options={{ title: 'Info' }}
      />
      <SettingsStack.Screen
        name="ResetPwd"
        component={ResetPwd}
        options={{ title: 'Reset' }}
      />
      <SettingsStack.Screen
        name="RecoverSeed"
        component={RecoverSeed}
        options={{ title: 'Recover' }}
      />
      <SettingsStack.Screen
        name="GeneralWalletSettings"
        component={GeneralWalletSettings}
        options={{ title: 'General' }}
      />
      <SettingsStack.Screen
        name="AddressBlocklist"
        component={AddressBlocklist}
        options={{ title: 'Blocked Addresses' }}
      />
      <SettingsStack.Screen
        name="VrpcOverrides"
        component={VrpcOverrides}
        options={{ title: 'Custom RPC Servers' }}
      />
      <SettingsStack.Screen
        name="CoinSettings"
        component={CoinSettings}
        options={({ route }) => ({
          title: route.params != null ? route.params.title : null,
        })}
      />
      <SettingsStack.Screen
        name="DisplaySeed"
        component={DisplaySeed}
        options={{ title: 'Seed', headerRight: () => null }}
      />
      <SettingsStack.Screen
        name="DeleteProfile"
        component={DeleteProfile}
        options={{ title: 'Delete' }}
      />
      <SettingsStack.Screen
        name="SecureLoading"
        component={SecureLoading}
        options={{
          title: 'Loading',
          headerRight: () => null,
          headerLeft: () => null,
        }}
      />
    </SettingsStack.Navigator>
  );
};

export default SettingsStackScreens;

