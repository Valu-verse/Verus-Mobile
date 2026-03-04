/*
  IdentityListItem
  - 2026-02-09: Chain badge styling: VRSC/VRSCTEST use VRSC brand color (#3165D4) text and
    light blue background; all other chains use grey pill and text.
  - 2026-01-14: Make list rows identity-first by removing the i-address from the row and
    focusing the row on the VerusID name + network.
  - 2026-01-14: Removed DeterministicAvatar per updated UX direction (text-only rows).
*/
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Colors from '../../../../globals/colors';

const VRSC_NETWORKS = ['VRSC', 'VRSCTEST'];

const IdentityListItem = ({
  name,
  network,
  isPreferred,
  onPress,
  subtitle,
  contentRightInset = 0,
}) => {
  const isVrsc = network && VRSC_NETWORKS.includes(network);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.container}
    >
      <View style={styles.mainRow}>
        <View style={[styles.textContainer, contentRightInset ? { paddingRight: contentRightInset } : null]}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="middle">{name}</Text>
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {network && (
          <View style={[styles.networkPill, isVrsc ? styles.networkPillVrsc : styles.networkPillOther]}>
            <Text style={[styles.networkText, isVrsc ? styles.networkTextVrsc : styles.networkTextOther]}>
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
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  networkPillVrsc: {
    backgroundColor: '#E8EEFC', // Light blue tint for VRSC
  },
  networkPillOther: {
    backgroundColor: '#F0F0F0', // Grey for other chains
  },
  networkText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  networkTextVrsc: {
    color: '#3165D4', // VRSC brand color
  },
  networkTextOther: {
    color: '#888',
  },
});

export default IdentityListItem;
