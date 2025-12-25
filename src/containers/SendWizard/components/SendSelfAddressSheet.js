/*
  SendSelfAddressSheet
  - Bottom sheet for selecting own address for "Send to self"
  - Shows user's available addresses filtered by address type
  - Styled after SendSourceSubwalletSheet pattern (card-based)
  - Created 2024-12-09
  - Updated 2024-12-09: Added addressType prop for better descriptions
  - Updated 2024-12-15: Redesigned to match SendSourceSubwalletSheet card style,
    VerusIDs show name with i-address below, regular addresses show address only
*/

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Portal, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import { ADDRESS_TYPE } from '../sendWizardDisplayInfo';

const SendSelfAddressSheet = ({
  visible,
  addresses,
  onClose,
  onSelect,
  addressType,
}) => {
  const insets = useSafeAreaInsets();
  const paddingBottom = 16 + insets.bottom;

  if (!visible) return null;

  // Truncate address for display
  const truncateAddress = (addr) => {
    if (!addr || addr.length <= 20) return addr;
    return `${addr.substring(0, 10)}...${addr.substring(addr.length - 8)}`;
  };

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        flexHeight={0.01}
        contentContainerStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flex: 0,
          width: '100%',
          alignSelf: 'flex-end',
          paddingBottom,
          maxHeight: '70%',
        }}
      >
        <View>
          {/* Header */}
          <View style={styles.header}>
            <Button onPress={onClose} textColor={Colors.primaryColor}>
              Close
            </Button>
            <Text style={styles.headerTitle}>Your addresses</Text>
            <View style={{ width: 64 }} />
          </View>

          {/* Description */}
          <View style={styles.description}>
            <Text style={styles.descriptionText}>
              Select one of your {addressType === ADDRESS_TYPE.ETHEREUM ? 'Ethereum' : 'Verus'} addresses to send to yourself.
            </Text>
          </View>

          {/* Addresses list */}
          <ScrollView style={{ maxHeight: 400 }}>
            <View style={styles.listContainer}>
              {addresses.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No addresses available.</Text>
                </View>
              ) : (
                addresses.map((item) => {
                  const isVerusID = item.isVerusID || false;

                  return (
                    <TouchableOpacity
                      key={item.id || item.address}
                      style={styles.addressCard}
                      onPress={() => onSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.addressContent}>
                        {isVerusID ? (
                          // VerusID: show name as primary, i-address as secondary
                          <>
                            <Text style={styles.primaryText} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.secondaryText} numberOfLines={1}>
                              {truncateAddress(item.address)}
                            </Text>
                          </>
                        ) : (
                          // Regular address: show address only
                          <Text style={styles.primaryText} numberOfLines={1}>
                            {truncateAddress(item.address)}
                          </Text>
                        )}
                      </View>
                      <MaterialCommunityIcons 
                        name="chevron-right" 
                        size={20} 
                        color="#CCC" 
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </SemiModal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  description: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  addressContent: {
    flex: 1,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  secondaryText: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default SendSelfAddressSheet;
