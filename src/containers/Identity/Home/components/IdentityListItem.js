/*
  IdentityListItem
  - 2026-01-14: Make list rows identity-first by removing the i-address from the row and
    focusing the row on the VerusID name + network.
  - 2026-01-14: Removed DeterministicAvatar per updated UX direction (text-only rows).
*/
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Colors from '../../../../globals/colors';

const IdentityListItem = ({ 
  name, 
  network, 
  isPreferred, 
  onPress,
  subtitle,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.container}
    >
      <View style={styles.mainRow}>
        <View style={styles.textContainer}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {network && (
          <View style={[styles.networkPill, isPreferred && styles.networkPillPreferred]}>
            <Text style={[styles.networkText, isPreferred && styles.networkTextPreferred]}>
              {network}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 76,
    justifyContent: 'center',
    // Clean card style
    borderWidth: 1,
    borderColor: '#EDEFF3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.quinaryColor,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.verusDarkGray,
    letterSpacing: -0.1,
  },
  networkPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    marginLeft: 8,
    alignSelf: 'flex-start', // Top align if multi-line, but centered here
  },
  networkPillPreferred: {
    backgroundColor: '#E8F5E8', // Light green
  },
  networkText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
  },
  networkTextPreferred: {
    color: Colors.verusGreenColor,
  },
});

export default IdentityListItem;
