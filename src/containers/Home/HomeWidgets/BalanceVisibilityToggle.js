/*
  BalanceVisibilityToggle
  - 2025-11-22: Extracted from navigation header so Home can place the toggle inline.
*/
import React, { memo } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import Colors from '../../../globals/colors';

const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const BalanceVisibilityToggle = ({ style }) => {
  const dispatch = useDispatch();
  const showBalance = useSelector((state) => state.coins.showBalance);

  const handleToggle = () => {
    dispatch({ type: 'SET_BALANCE_SHOW' });
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        onPress={handleToggle}
        hitSlop={iconHitSlop}
        accessibilityRole="button"
        accessibilityLabel={showBalance ? 'Hide balances' : 'Show balances'}
        activeOpacity={0.75}
      >
        <MaterialCommunityIcons
          name={showBalance ? 'eye-off' : 'eye'}
          size={20}
          color={Colors.verusDarkGray}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 6,
  },
});

export default memo(BalanceVisibilityToggle);

