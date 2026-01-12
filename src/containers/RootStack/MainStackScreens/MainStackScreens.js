/*
  2025-11-22: Removed Settings routes from MainStack now that Settings has its
  own bottom-tab stack, keeping MainStack focused on wallet/coin flows.
  2024-12-09: Added SendWizard navigator for new send/convert flow.
*/
import React from 'react';
import { createStackNavigator } from "@react-navigation/stack";
import { defaultHeaderOptions } from '../../../utils/navigation/header';
import AddCoin from '../../AddCoin/AddCoin'
import CoinDetails from '../../CoinDetails/CoinDetails'
import DisplaySeed from '../../DisplaySeed/DisplaySeed'
import CoinMenus from '../../Coin/CoinMenus'
import SecureLoading from '../../SecureLoading/SecureLoading'
import HomeTabScreens from '../HomeTabScreens/HomeTabScreens';
import ReceiveAssetsList from '../../Transfer/ReceiveAssetsList';
import ReceiveAssetDetails from '../../Transfer/ReceiveAssetDetails';
import ValuSocialScreen from '../../ValuSocial/ValuSocialScreen';
import SendWizardNavigator from '../../SendWizard/SendWizardNavigator';

const MainStack = createStackNavigator();

const MainStackScreens = props => {
  return (
    <MainStack.Navigator
      screenOptions={defaultHeaderOptions}
    >
      <MainStack.Screen
        name="Home"
        component={HomeTabScreens}
        options={{ headerShown: false }}
      />

      <MainStack.Screen
        name="AddCoin"
        component={AddCoin}
        options={{
          title: "Add assets",
        }}
      />

      <MainStack.Screen
        name="CoinDetails"
        component={CoinDetails}
        options={{
          title: "Details",
        }}
      />

      <MainStack.Screen
        name="DisplaySeed"
        component={DisplaySeed}
        options={{
          title: "Seed",
          headerRight: () => null,
        }}
      />

      <MainStack.Screen name="CoinMenus" component={CoinMenus} />

      <MainStack.Screen
        name="ReceiveAssetsList"
        component={ReceiveAssetsList}
        options={{
          title: 'Receive assets',
        }}
      />

      <MainStack.Screen
        name="ReceiveAssetDetails"
        component={ReceiveAssetDetails}
        options={{
          title: 'Receive',
        }}
      />
      <MainStack.Screen
        name="SecureLoading"
        component={SecureLoading}
        options={{
          title: "Loading",
          headerRight: () => null,
          headerLeft: () => null,
        }}
      />
      <MainStack.Screen
        name="ValuSocial"
        component={ValuSocialScreen}
        options={{
          title: "Valu Social",
        }}
      />
      <MainStack.Screen
        name="SendWizard"
        component={SendWizardNavigator}
        options={{
          headerShown: false,
        }}
      />
    </MainStack.Navigator>
  );
};

export default MainStackScreens