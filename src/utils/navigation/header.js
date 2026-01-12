/*
  Updated header defaults:
  - Header background set to white (Colors.secondaryColor)
  - Title and icons switched to black (Colors.quinaryColor)
  Update 2025-09-29:
  - Standardized margins for the show/hide balance icons so the icon
    position doesn't shift when toggling between "eye" and "eye-off".
  Update 2025-10-10:
  - Header title font standardized to Source Sans Pro to match app-wide font
    usage. Use Bold weight, font size 20, and slightly tighter letter spacing
    for improved readability.
  Update 2025-10-10 (late):
  - Revert header title to platform system font for consistency with most
    in-app text. Keep size 20, bold weight, and slightly reduced letter
    spacing.
  Update 2025-10-03:
  - Added notification bell icon with badge count
  Update 2025-11-22:
  - Removed the obsolete hamburger trigger now that the drawer is gone.
*/
import React, {useMemo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Badge} from 'react-native-paper';
import Colors from '../../globals/colors';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';

const Header = () => {
  const navigation = useNavigation(); // Use the hook here
  const dispatch = useDispatch();
  const showBalance = useSelector(state => state.coins.showBalance);
  const notifications = useSelector(state => state.notifications);
  const acchash = useSelector(state => state.authentication.activeAccount?.accountHash);

  // Determine active bottom tab to control eye toggle visibility
  let showEyeToggle = true;
  try {
    const parent = navigation.getParent && navigation.getParent();
    const parentState = parent && parent.getState ? parent.getState() : null;
    const activeParentRoute = parentState && parentState.routes ? parentState.routes[parentState.index] : null;
    const activeTabName = activeParentRoute ? activeParentRoute.name : null;
    // Only show eye toggle on Home (WalletHome) and Assets (AssetsHome)
    if (activeTabName && !['WalletHome', 'AssetsHome'].includes(activeTabName)) {
      showEyeToggle = false;
    }
  } catch (e) {
    // Fallback: keep default visibility
    showEyeToggle = true;
  }

  const handleBalanceShow = event => {
    event.preventDefault();
    event.stopPropagation();
    dispatch({type: 'SET_BALANCE_SHOW'});
  };

  const notificationCount = useMemo(() => {
    if (!notifications.directory || !acchash) return 0;
    return Object.keys(notifications.directory).filter(
      uid => notifications.directory[uid].acchash === acchash
    ).length;
  }, [notifications, acchash]);

  const handleNotificationPress = () => {
    navigation.navigate('Notifications');
  };

  return (
    <TouchableOpacity style={{paddingRight: 8}}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        {showEyeToggle && (
          showBalance ? (
            <TouchableOpacity
              onPress={handleBalanceShow}
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <MaterialCommunityIcons
                name="eye-off"
                size={22}
                color={Colors.verusDarkGray}
                style={{
                  marginLeft: 5,
                  marginRight: 10,
                }}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleBalanceShow}
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <MaterialCommunityIcons
                name="eye"
                size={22}
                color={Colors.verusDarkGray}
                style={{
                  marginLeft: 5,
                  marginRight: 10,
                }}
              />
            </TouchableOpacity>
          )
        )}

        <TouchableOpacity
          onPress={handleNotificationPress}
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
            position: 'relative',
          }}>
          <MaterialCommunityIcons
            name="bell-outline"
            size={24}
            color={Colors.verusDarkGray}
          />
          {notificationCount > 0 && (
            <Badge
              size={20}
              style={{
                position: 'absolute',
                top: -6,
                right: -10,
                backgroundColor: Colors.primaryColor,
                borderWidth: 1,
                borderColor: '#FFFFFF',
              }}
              labelStyle={{
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </Badge>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export const defaultHeaderOptions = ({navigation, params, route}) => ({
  headerShown: true,
  headerMode: 'screen',
  headerStyle: {
    backgroundColor: Colors.secondaryColor,
  },
  headerTitleStyle: {
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: -0.3,
    color: Colors.quinaryColor,
  },
  headerRight: () => <Header />,
  headerTintColor: Colors.quinaryColor,
});
