import * as React from 'react';
import {Menu, IconButton} from 'react-native-paper';
import {Platform, StatusBar, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Colors from '../../globals/colors';

const SignedOutDropdown = (props) => {
  const {
    handleRecoverSeed,
    handleRevokeRecover,
    handlePendingRequests,
    handleClearPendingRequests,
    handleReadDeeplinkFromNfc,
    hasAccount,
    pendingRequestCount = 0,
  } = props;
  const [visible, setVisible] = React.useState(false);
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  const openMenu = () => setVisible(true);

  const closeMenu = () => setVisible(false);

  const actions = [
    ...(handleReadDeeplinkFromNfc
      ? [
          {
            label: 'Read deeplink from NFC',
            onPress: handleReadDeeplinkFromNfc,
          },
        ]
      : []),
    ...(hasAccount
      ? [
          {
            label: 'Recover profile seed',
            onPress: handleRecoverSeed,
          },
          {
            label: 'Revoke or recover VerusID',
            onPress: handleRevokeRecover,
          }
        ];

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: "flex-end",
        paddingTop: topInset,
        paddingRight: 4,
        zIndex: 20,
        elevation: 20,
      }}>
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
    </View>
  );
};

export default SignedOutDropdown;
