/*
  AddressBookSheet
  - Bottom sheet for selecting saved addresses in send flow
  - Shows addresses filtered by destination type (Verus/Ethereum)
  - Includes search functionality
  - Created 2026-01-22
*/

import React, { useState, useMemo, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  TextInput as RNTextInput,
} from 'react-native';
import { Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import { 
  truncateAddress, 
  isAddressTypeCompatible,
  ADDRESS_TYPE_SHORT_LABELS,
} from '../../../utils/constants/addressBook';

const AddressBookSheet = ({
  visible,
  addresses,
  destinationType,
  onClose,
  onSelect,
  onManage,
  onAddNew,
}) => {
  const insets = useSafeAreaInsets();
  const paddingBottom = 16 + insets.bottom;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Filter addresses by destination type and search query
  const filteredAddresses = useMemo(() => {
    let filtered = addresses || [];
    
    // Filter by address type compatibility
    if (destinationType) {
      filtered = filtered.filter((addr) => 
        isAddressTypeCompatible(addr.type, destinationType)
      );
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((addr) => 
        addr.label?.toLowerCase().includes(query) ||
        addr.address?.toLowerCase().includes(query)
      );
    }
    
    // Sort by most recently used, then by label
    return filtered.sort((a, b) => {
      if (a.lastUsed && b.lastUsed) return b.lastUsed - a.lastUsed;
      if (a.lastUsed) return -1;
      if (b.lastUsed) return 1;
      return (a.label || '').localeCompare(b.label || '');
    });
  }, [addresses, destinationType, searchQuery]);

  const handleSelect = useCallback((address) => {
    setSearchQuery('');
    onSelect(address);
  }, [onSelect]);

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  if (!visible) return null;

  const hasAddresses = addresses && addresses.length > 0;
  const hasFilteredAddresses = filteredAddresses.length > 0;
  const typeLabel = destinationType === 'ethereum' || destinationType === 'ETHEREUM' 
    ? 'Ethereum' 
    : 'Verus';

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={handleClose}
        title="Saved Addresses"
        flexHeight={0.01}
        contentContainerStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flex: 0,
          width: '100%',
          alignSelf: 'flex-end',
          paddingBottom,
          maxHeight: '80%',
        }}
      >
        <View style={styles.container}>
          {/* Search bar */}
          {hasAddresses && (
            <View style={styles.searchContainer}>
              <View
                style={[
                  styles.searchInputContainer,
                  searchFocused && styles.searchInputFocused,
                ]}
              >
                <RNTextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search by name or address"
                  placeholderTextColor="#999"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={styles.searchInput}
                />
                <View style={styles.searchIcon}>
                  <MaterialCommunityIcons name="magnify" size={20} color="#999" />
                </View>
              </View>
            </View>
          )}

          {/* Address list */}
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {!hasAddresses ? (
              // Empty state - no addresses saved at all
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons 
                  name="book-plus-outline" 
                  size={48} 
                  color="#CCC" 
                  style={styles.emptyIcon}
                />
                <Text style={styles.emptyTitle}>No saved addresses</Text>
                <Text style={styles.emptyText}>
                  Save addresses for quick access when sending
                </Text>
                {onAddNew && (
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={onAddNew}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={Colors.primaryColor} />
                    <Text style={styles.addButtonText}>Add address</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : !hasFilteredAddresses ? (
              // No matches for search/filter
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery.trim() 
                    ? 'No addresses match your search'
                    : `No ${typeLabel} addresses saved`}
                </Text>
              </View>
            ) : (
              // Address list
              <View style={styles.listContainer}>
                {filteredAddresses.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.addressCard}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addressContent}>
                      <View style={styles.addressHeader}>
                        <Text style={styles.labelText} numberOfLines={1}>
                          {item.label}
                        </Text>
                        {item.type && (
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>
                              {ADDRESS_TYPE_SHORT_LABELS[item.type] || item.type}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addressText} numberOfLines={1}>
                        {truncateAddress(item.address, 12, 8)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons 
                      name="chevron-right" 
                      size={20} 
                      color="#CCC" 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer with manage button */}
          {hasAddresses && onManage && (
            <View style={styles.footer}>
              <TouchableOpacity 
                style={styles.manageButton}
                onPress={onManage}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="cog-outline" size={18} color={Colors.primaryColor} />
                <Text style={styles.manageButtonText}>Manage addresses</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SemiModal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 0,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    height: 44,
  },
  searchInputFocused: {
    backgroundColor: '#FFF',
    borderColor: Colors.primaryColor,
    shadowColor: Colors.primaryColor,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#000',
  },
  searchIcon: {
    paddingHorizontal: 14,
    height: '100%',
    justifyContent: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    flexGrow: 1,
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
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  typeBadge: {
    backgroundColor: '#E8EEFB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryColor,
  },
  addressText: {
    fontSize: 13,
    color: '#888',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#EBF6FF',
    borderRadius: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryColor,
    marginLeft: 6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8E8',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryColor,
    marginLeft: 6,
  },
});

export default AddressBookSheet;
