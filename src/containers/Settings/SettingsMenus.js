/*
  2025-11-24: Replaced the Settings bottom tabs with a single list of
  destinations so users pick Profile, Wallet, or App Info like other list
  screens before drilling into each section. Added an explicit log-out entry
  after removing the drawer shortcut.
  2026-01-12: Restyled the Lock profile button to match the soft filled pill
  buttons used elsewhere (e.g., Wallet Transfer / Identity empty state) and
  updated the icon to `lock` with a slightly larger size.
  2026-01-13: When explicitly locking from Settings, suppress Unlock auto-biometric prompting so users
  can switch profiles before authenticating.
*/

import React, { Component } from "react";
import { View, StyleSheet, ScrollView, Text, SafeAreaView } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { connect } from 'react-redux';
import { List, Button } from "react-native-paper"
import {
  setConfigSection,
  signOut,
  setSuppressUnlockAutoBiometrics,
} from '../../actions/actionCreators';
import { clearActiveAccountLifecycles } from '../../actions/actionDispatchers';
import Colors from '../../globals/colors';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const SETTINGS_BACKGROUND = '#FFFFFF';

const SETTINGS_DESTINATIONS = [
  {
    key: 'settings-profile',
    title: 'Profile & security',
    description: 'Identity, security and seed recovery',
    icon: 'account',
    route: 'ProfileSettings',
  },
  {
    key: 'settings-wallet',
    title: 'Wallet',
    description: 'General preferences, RPC overrides, and cache options',
    icon: 'wallet',
    route: 'WalletSettings',
  },
  {
    key: 'settings-info',
    title: 'App info',
    description: 'Version details, licenses, and diagnostics',
    icon: 'information',
    route: 'AppInfo',
  },
];

class SettingsMenus extends Component {
  componentDidMount() {
    this.props.navigation.setOptions({
      headerShown: false,
    });
  }

  handleNavigate = (destination) => {
    const { dispatch, navigation } = this.props;
    dispatch(setConfigSection(destination.key));
    navigation.navigate(destination.route);
  };

  getNavigatorForRoute = (routeName) => {
    let nav = this.props.navigation;

    while (nav) {
      const state = nav.getState ? nav.getState() : null;
      if (state?.routeNames?.includes(routeName)) {
        return nav;
      }
      nav = nav.getParent ? nav.getParent() : null;
    }

    return this.props.navigation;
  };

  resetToScreen = (route, title, data, fullReset = false) => {
    const targetNavigation = this.getNavigatorForRoute(route);
    if (!targetNavigation) return;

    let resetConfig;

    if (fullReset) {
      resetConfig = {
        index: 0,
        routes: [{ name: route, params: { data } }],
      };
    } else {
      resetConfig = {
        index: 1,
        routes: [
          { name: 'Home' },
          { name: route, params: { title, data } },
        ],
      };
    }

    targetNavigation.dispatch(CommonActions.reset(resetConfig));
  };

  handleLogout = () => {
    const { dispatch } = this.props;
    const data = {
      task: () => {
        return new Promise((resolve) => {
          setTimeout(async () => {
            await clearActiveAccountLifecycles();
            dispatch(setSuppressUnlockAutoBiometrics(true));
            dispatch(signOut());
            resolve();
          }, 1000);
        });
      },
      message: "Signing out...",
      route: "Home",
      successMsg: "Signed out",
      errorMsg: "Failed to sign out",
    };

    this.resetToScreen("SecureLoading", null, data, true);
  };

  render() {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.container}>
          <View style={styles.headerContainer}>
            <Text style={styles.mainTitle}>Settings</Text>
          </View>
          <List.Section>
          {SETTINGS_DESTINATIONS.map((destination) => (
            <List.Item
              key={destination.key}
              title={destination.title}
              description={destination.description}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={[styles.listItem, { paddingVertical: 8 }]}
              left={(props) => <List.Icon {...props} icon={destination.icon} color={'black'} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => this.handleNavigate(destination)}
            />
          ))}
        </List.Section>
        
        <View style={styles.logoutContainer}>
          <Button
            mode="contained"
            onPress={this.handleLogout}
            style={styles.logoutButton}
            contentStyle={{ height: 44 }}
            uppercase={false}
            labelStyle={styles.logoutLabel}
            buttonColor="#EBF6FF"
            textColor={Colors.primaryColor}
            icon={({ size, color }) => (
              <MaterialCommunityIcons
                name="lock"
                size={Math.max(size + 2, 20)}
                color={color}
                style={{ opacity: 0.9 }}
              />
            )}
          >
            Lock profile
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
    );
  }
}

export default connect()(SettingsMenus);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SETTINGS_BACKGROUND,
  },
  headerContainer: {
    paddingHorizontal: 16,
    backgroundColor: SETTINGS_BACKGROUND,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 8,
    marginTop: 8,
  },
  listItem: {
    backgroundColor: SETTINGS_BACKGROUND,
  },
  logoutContainer: {
    padding: 24,
    alignItems: 'center',
  },
  logoutButton: {
    borderRadius: 22,
    borderWidth: 0,
    backgroundColor: '#EBF6FF',
    width: 160,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  logoutLabel: {
    color: Colors.primaryColor,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'none',
    letterSpacing: -0.2,
  },
});

