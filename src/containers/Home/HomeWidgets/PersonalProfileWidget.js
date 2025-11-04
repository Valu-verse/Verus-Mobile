/*
  PersonalProfileWidget
  2025-11-04: Flattened to a full-width surface with subtle border and no card chrome.
*/
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../../globals/colors';

const PersonalProfileWidget = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{'Personal profile'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    backgroundColor: Colors.secondaryColor,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.quinaryColor,
    letterSpacing: -0.2,
  },
});

export default PersonalProfileWidget;


