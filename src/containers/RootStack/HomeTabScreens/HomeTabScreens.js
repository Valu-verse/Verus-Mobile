/*
  Updated HomeTabScreens:
  - Switched to createBottomTabNavigator to enable explicit tabBarStyle control
  - Preserved the previous color scheme for active/inactive icons and background
*/
import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Colors from '../../../globals/colors';
import WalletStackScreens from '../WalletStackScreens/WalletStackScreens';
import AssetsStackScreens from '../AssetsStackScreens/AssetsStackScreens';
import ActivityStackScreens from '../ActivityStackScreens/ActivityStackScreens';
import ProfileStackScreens from '../ProfileStackScreens/ProfileStackScreens';
import ServicesStackScreens from '../ServicesStackScreens/ServicesStackScreens';
import VerusPay from '../../VerusPay/VerusPay';

const HomeTabs = createBottomTabNavigator();

const HomeTabScreens = props => {
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
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Feather name="home" color={color} size={22} style={{ marginBottom: 2 }} />
          ),
        }}
      />

      <HomeTabs.Screen
        name="AssetsHome"
        component={AssetsStackScreens}
        options={{
          title: "Assets",
          tabBarIcon: ({ color }) => (
            <Feather name="list" color={color} size={22} style={{ marginBottom: 2 }} />
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