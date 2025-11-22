/*
  2025-11-24: Replaced the Settings bottom tabs with a single list of
  destinations so users pick Profile, Wallet, or App Info like other list
  screens before drilling into each section.
*/

import React, { Component } from "react";
import { View, StyleSheet } from 'react-native';
import { connect } from 'react-redux';
import { List } from "react-native-paper"
import { setConfigSection } from '../../actions/actionCreators';

const SETTINGS_BACKGROUND = '#FFFFFF';

const SETTINGS_DESTINATIONS = [
  {
    key: 'settings-profile',
    title: 'Profile',
    description: 'Identity, security, and Wyre account controls',
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

  render() {
    return (
      <View style={styles.container}>
        <List.Section style={styles.section}>
          {SETTINGS_DESTINATIONS.map((destination) => (
            <List.Item
              key={destination.key}
              title={destination.title}
              description={destination.description}
              style={styles.listItem}
              left={(props) => <List.Icon {...props} icon={destination.icon} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => this.handleNavigate(destination)}
            />
          ))}
        </List.Section>
      </View>
    );
  }
}

export default connect()(SettingsMenus);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SETTINGS_BACKGROUND,
  },
  section: {
    backgroundColor: SETTINGS_BACKGROUND,
    margin: 0,
    paddingTop: 8,
  },
  listItem: {
    backgroundColor: SETTINGS_BACKGROUND,
  },
});

