/*
  2025-11-22: Added a dedicated Settings tab (powered by SettingsStackScreens)
  so users can reach Settings without the drawer and kept icon styling intact.
*/
import React from 'react';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Colors from '../../../globals/colors';
import WalletStackScreens from '../WalletStackScreens/WalletStackScreens';
import ActivityStackScreens from '../ActivityStackScreens/ActivityStackScreens';
import ServicesStackScreens from '../ServicesStackScreens/ServicesStackScreens';
import VerusPay from '../../VerusPay/VerusPay';
import SettingsStackScreens from '../SettingsStackScreens/SettingsStackScreens';
import { useDispatch } from 'react-redux';
import { setConfigSection } from '../../../actions/actionCreators';

const HomeTabs = createBottomTabNavigator();

const HomeTabScreens = props => {
  const dispatch = useDispatch();

  return (
    <HomeTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryColor,
        tabBarInactiveTintColor: Colors.verusDarkGray,
        tabBarStyle: {
          backgroundColor: Colors.secondaryColor,
          borderTopColor: 'transparent',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <HomeTabs.Screen
        name="WalletHome"
        component={WalletStackScreens}
        options={{
          title: "Wallet",
          tabBarIcon: ({ color }) => (
            <Feather name="credit-card" color={color} size={22} style={{ marginBottom: 2 }} />
          ),
        }}
      />

      {/* Personal tab removed: surfaced as a Home card */}
      <HomeTabs.Screen
        name="ServicesHome"
        component={ServicesStackScreens}
        options={{
          title: "Services",
          tabBarIcon: ({ color }) => (
            <Feather name="grid" color={color} size={22} style={{ marginBottom: 2 }} />
          ),
        }}
      />
      <HomeTabs.Screen
        name="ActivityHome"
        component={ActivityStackScreens}
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => (
            <Feather name="clock" color={color} size={22} style={{ marginBottom: 2 }} />
          ),
        }}
      />
      <HomeTabs.Screen
        name="SettingsHome"
        component={SettingsStackScreens}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Feather name="settings" color={color} size={22} style={{ marginBottom: 2 }} />
          ),
        }}
        listeners={{
          focus: () => dispatch(setConfigSection('settings-profile')),
        }}
      />
      {/* <HomeTabs.Screen
        name="Convert"
        component={ConvertStackScreens}
        options={{
          title: "Convert",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="swap-horizontal"
              color={color}
              size={26}
            />
          ),
        }}
      /> */}
      <HomeTabs.Screen
        name="VerusPay"
        component={VerusPay}
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="qrcode-scan"
              color={color}
              size={26}
            />
          ),
        }}
      />
    </HomeTabs.Navigator>
  );
};

export default HomeTabScreens