/*
  HomeTabScreens (bottom tab bar)
  - 2026-01-09: Replaced Activity bottom tab with Identity placeholder tab and
    use verusid-at icon (tinted to match active/inactive tab colors).
  - 2025-11-22: Added a dedicated Settings tab (powered by SettingsStackScreens)
    so users can reach Settings without the drawer and kept icon styling intact.
  - 2026-01-13: Renamed the Identity tab route to `IdentityTab` to avoid a nested
    duplicate screen name warning (tab `IdentityHome` contained stack screen `IdentityHome`).
  - 2026-01-22: Standardized all tab icons to Feather for visual consistency.
    Services uses "compass", Scan uses "maximize" (scanning frame corners).
*/
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Colors from '../../../globals/colors';
import WalletStackScreens from '../WalletStackScreens/WalletStackScreens';
import IdentityStackScreens from '../IdentityStackScreens/IdentityStackScreens';
import ServicesStackScreens from '../ServicesStackScreens/ServicesStackScreens';
import VerusPay from '../../VerusPay/VerusPay';
import SettingsStackScreens from '../SettingsStackScreens/SettingsStackScreens';
import VerusIdAtIcon from '../../../images/customIcons/verusid-at-icon.svg';
import { useDispatch } from 'react-redux';
import { setConfigSection } from '../../../actions/actionCreators';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import {
  NOTIFICATION_TYPE_VERUSID_ERROR,
  NOTIFICATION_TYPE_VERUSID_READY,
} from '../../../utils/constants/services';

const HomeTabs = createBottomTabNavigator();

const isActionableIdentityStatus = (status) =>
  status === NOTIFICATION_TYPE_VERUSID_READY || status === NOTIFICATION_TYPE_VERUSID_ERROR;

const HomeTabScreens = props => {
  const dispatch = useDispatch();
  const pendingIds = useObjectSelector((state) => state.channelStore_verusid?.pendingIds || {});
  const [lastSeenPendingIdentityKey, setLastSeenPendingIdentityKey] = useState('');

  const pendingIdentityMeta = useMemo(() => {
    const actionable = [];

    for (const chainId of Object.keys(pendingIds || {})) {
      const chainMap = pendingIds[chainId] || {};
      for (const iAddr of Object.keys(chainMap)) {
        const details = chainMap[iAddr] || {};
        if (!isActionableIdentityStatus(details.status)) continue;

        actionable.push(
          `${chainId}:${iAddr}:${details.status || ''}:${details.notificationUid || ''}:${details.createdAt || ''}`,
        );
      }
    }

    actionable.sort();

    return {
      count: actionable.length,
      key: actionable.join('|'),
    };
  }, [pendingIds]);

  const hasUnseenIdentityPending =
    pendingIdentityMeta.count > 0 && pendingIdentityMeta.key !== lastSeenPendingIdentityKey;

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
            <Feather name="compass" color={color} size={22} style={{ marginBottom: 2 }} />
          ),
        }}
      />
      <HomeTabs.Screen
        name="IdentityTab"
        component={IdentityStackScreens}
        listeners={{
          focus: () => {
            setLastSeenPendingIdentityKey(pendingIdentityMeta.key);
          },
        }}
        options={{
          title: "Identity",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.identityIconWrap}>
              <VerusIdAtIcon width={22} height={22} fill={color} style={{ marginBottom: 2 }} />
              {hasUnseenIdentityPending && !focused && <View style={styles.identityAlertDot} />}
            </View>
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
            <Feather name="maximize" color={color} size={24} style={{ marginBottom: 2 }} />
          ),
        }}
      />
    </HomeTabs.Navigator>
  );
};

const styles = StyleSheet.create({
  identityIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  identityAlertDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});

export default HomeTabScreens
