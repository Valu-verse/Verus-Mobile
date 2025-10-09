/*
  Updated header defaults:
  - Header background set to white (Colors.secondaryColor)
  - Title and icons switched to black (Colors.quinaryColor)
  Update 2025-09-29:
  - Standardized margins for the show/hide balance icons so the icon
    position doesn't shift when toggling between "eye" and "eye-off".
  Update 2025-10-03:
  - Added notification bell icon with badge count
*/
import {DrawerActions} from '@react-navigation/compat';
import React, {useMemo} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Icon} from 'react-native-elements';
import {Badge} from 'react-native-paper';
import Colors from '../../globals/colors';
import styles from '../../styles';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';

const Header = () => {
  const navigation = useNavigation(); // Use the hook here
  const dispatch = useDispatch();
  const showBalance = useSelector(state => state.coins.showBalance);
  const notifications = useSelector(state => state.notifications);
  const acchash = useSelector(state => state.authentication.activeAccount?.accountHash);

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
        {showBalance ? (
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

        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}>
          <Icon name="menu" size={28} color={Colors.verusDarkGray} />
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
    fontFamily: 'Avenir-Black',
    fontWeight: 'normal',
    fontSize: 22,
    color: Colors.quinaryColor,
  },
  headerRight: () => <Header />,
  headerTintColor: Colors.quinaryColor,
});
