/*
  New file: IdentityPlaceholder
  - 2026-01-09: Placeholder screen for the Identity bottom tab (content to be built later).
*/
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const IdentityPlaceholder = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.mainTitle}>Identity</Text>
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.placeholderText}>Identity coming soon</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  headerContainer: {
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 16,
    marginTop: 8,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: 'black',
  },
});

export default IdentityPlaceholder;

