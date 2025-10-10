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
*/
import {DrawerActions} from '@react-navigation/compat';
import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Icon} from 'react-native-elements';
import Colors from '../../globals/colors';
import styles from '../../styles';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';

const Header = () => {
  const navigation = useNavigation(); // Use the hook here
  const dispatch = useDispatch();
  const showBalance = useSelector(state => state.coins.showBalance);

  const handleBalanceShow = event => {
    event.preventDefault();
    event.stopPropagation();
    dispatch({type: 'SET_BALANCE_SHOW'});
  };

  return (
    <TouchableOpacity style={{paddingRight: 8}}>
      <View
        style={{
          flexDirection: 'row',
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
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: -0.3,
    color: Colors.quinaryColor,
  },
  headerRight: () => <Header />,
  headerTintColor: Colors.quinaryColor,
});
