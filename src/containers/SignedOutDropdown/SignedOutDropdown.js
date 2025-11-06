import * as React from 'react';
import { Menu, Text } from 'react-native-paper';
import { SafeAreaView, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../../globals/colors';

const SignedOutDropdown = (props) => {
  const {
    handleRecoverSeed,
    handleRevokeRecover,
    hasAccount
  } = props;
  const [visible, setVisible] = React.useState(false);

  const openMenu = () => setVisible(true);

  const closeMenu = () => setVisible(false);

  const actions = !hasAccount
      ? []
      : [
          {
            label: 'Recover profile seed',
            onPress: handleRecoverSeed,
          },
          {
            label: 'Revoke or recover VerusID',
            onPress: handleRevokeRecover,
          }
        ];

  if (actions.length === 0) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={
          <TouchableOpacity
            onPress={openMenu}
            activeOpacity={0.8}
            style={styles.morePill}
          >
            <Text style={styles.moreLabel}>More</Text>
          </TouchableOpacity>
        }>
        {actions.map((action, index) => (
          <Menu.Item
            key={index}
            onPress={props => {
              closeMenu();
              action.onPress(props);
            }}
            title={action.label}
          />
        ))}
      </Menu>
    </SafeAreaView>
  );
};

export default SignedOutDropdown;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  morePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  moreLabel: {
    color: Colors.quinaryColor,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});