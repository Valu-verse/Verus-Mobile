/*
  2025-11-24: Replaced the Settings bottom tabs with a single list of
  destinations so users pick Profile, Wallet, or App Info like other list
  screens before drilling into each section. Added an explicit log-out entry
  after removing the drawer shortcut.
*/

import React, { Component } from "react";
import { View, StyleSheet, ScrollView } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { connect } from 'react-redux';
import { List, Button } from "react-native-paper"
import { setConfigSection, signOut } from '../../actions/actionCreators';
import { clearActiveAccountLifecycles } from '../../actions/actionDispatchers';
import Colors from '../../globals/colors';

const SETTINGS_BACKGROUND = '#FFFFFF';

const SETTINGS_DESTINATIONS = [
  {
    key: 'settings-profile',
    title: 'Profile',
    description: 'Identity, security and seed recovery',
    icon: 'account-settings',
    route: 'ProfileSettings',
  },
  {
    key: 'settings-wallet',
    title: 'Wallet',
    description: 'General preferences, RPC overrides, and cache options',
    icon: 'credit-card-settings',
    route: 'WalletSettings',
  },
  {
    key: 'settings-info',
    title: 'App Info',
    description: 'Version details, licenses, and diagnostics',
    icon: 'information',
    route: 'AppInfo',
  },
];

class SettingsMenus extends Component {
  componentDidMount() {
    this.props.navigation.setOptions({ title: 'Settings' });
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
      <ScrollView style={styles.container}>
        <List.Section>
          {SETTINGS_DESTINATIONS.map((destination) => (
            <List.Item
              key={destination.key}
              title={destination.title}
              description={destination.description}
              style={styles.listItem}
              left={(props) => <List.Icon {...props} icon={destination.icon} color={Colors.verusDarkGray} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => this.handleNavigate(destination)}
            />
          ))}
        </List.Section>
        
        <View style={styles.logoutContainer}>
          <Button
            mode="outlined"
            onPress={this.handleLogout}
            style={styles.logoutButton}
            contentStyle={{ height: 44 }}
            uppercase={false}
            labelStyle={styles.logoutLabel}
          >
            Log out
          </Button>
        </View>
      </ScrollView>
    );
  }
}

export default connect()(SettingsMenus);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SETTINGS_BACKGROUND,
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
    borderColor: Colors.verusDarkGray,
    borderWidth: 1,
    backgroundColor: SETTINGS_BACKGROUND,
    width: 160,
    elevation: 0,
  },
  logoutLabel: {
    color: Colors.verusDarkGray,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'none',
    letterSpacing: -0.2,
  },
});

