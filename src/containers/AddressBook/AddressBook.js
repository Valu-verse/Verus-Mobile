/*
  AddressBook
  - Main address book management screen
  - Displays list of saved addresses with search/filter
  - Allows adding, editing, and deleting addresses
  - Accessible from Services screen
  - Created 2026-01-22
  - Updated 2026-01-22: Added Bitcoin filter tab for BTC/LTC/other addresses
  - Updated 2026-01-22: Redesigned empty state to match Identity Home styling with GradientButton
  - Updated 2026-01-22: Redesigned header to match Identity/Wallet pattern with + icon in header
  - Updated 2026-01-22: Hide filters and search bar until 6+ addresses saved
  - Updated 2026-01-22: Removed FAB, updated chain badge styling
  - Updated 2026-01-22: Replaced copy popup with subtle checkmark feedback,
    replaced network badge with coin icon at start of row
*/

import React, { useState, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Alert,
  Clipboard,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from '../../globals/colors';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import {
  saveAddressToBook,
  updateAddressInBook,
  deleteAddressFromBook,
} from '../../actions/actionDispatchers';
import AddressBookEditSheet from './components/AddressBookEditSheet';
import {
  truncateAddress,
  ADDRESS_TYPE,
  ADDRESS_GROUP,
  getAddressGroup,
} from '../../utils/constants/addressBook';
import GradientButton from '../../components/GradientButton';
import { RenderPlainCoinLogo } from '../../utils/CoinData/Graphics';

// Map address types to coin tickers for logo display
const ADDRESS_TYPE_TO_TICKER = {
  [ADDRESS_TYPE.VERUS_R]: 'VRSC',
  [ADDRESS_TYPE.VERUS_I]: 'VRSC',
  [ADDRESS_TYPE.VERUS_ID]: 'VRSC',
  [ADDRESS_TYPE.ETHEREUM]: 'ETH',
  [ADDRESS_TYPE.BITCOIN]: 'BTC',
  [ADDRESS_TYPE.LITECOIN]: 'LTC',
  [ADDRESS_TYPE.ZCASH]: 'ZEC',
  [ADDRESS_TYPE.KOMODO]: 'KMD',
  [ADDRESS_TYPE.OTHER_CRYPTO]: 'BTC', // Default to BTC icon for unknown crypto
};

const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const FILTER_OPTIONS = [
  { id: ADDRESS_GROUP.ALL, label: 'All' },
  { id: ADDRESS_GROUP.VERUS, label: 'Verus' },
  { id: ADDRESS_GROUP.ETHEREUM, label: 'Ethereum' },
  { id: ADDRESS_GROUP.BITCOIN, label: 'Bitcoin' },
];

const AddressBook = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const addresses = useObjectSelector((state) => state.addressBook.addresses);
  const activeAccount = useSelector((state) => state.authentication.activeAccount);
  const accountHash = activeAccount?.accountHash;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState(ADDRESS_GROUP.ALL);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [showHeaderDivider, setShowHeaderDivider] = useState(false);
  const [copiedAddressId, setCopiedAddressId] = useState(null);
  const copyTimeoutRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerBackTitle: 'Back',
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: 'white',
        elevation: 0,
        shadowOpacity: 0,
      },
    });
  }, [navigation]);

  // Filter addresses
  const filteredAddresses = useMemo(() => {
    let filtered = addresses || [];

    // Filter by type group
    if (activeFilter !== ADDRESS_GROUP.ALL) {
      filtered = filtered.filter((addr) => 
        getAddressGroup(addr.type) === activeFilter
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

    // Sort by label
    return filtered.sort((a, b) => 
      (a.label || '').localeCompare(b.label || '')
    );
  }, [addresses, activeFilter, searchQuery]);

  // Handle add new
  const handleAddNew = useCallback(() => {
    setEditingAddress(null);
    setEditSheetVisible(true);
  }, []);

  // Handle edit
  const handleEdit = useCallback((address) => {
    setEditingAddress(address);
    setEditSheetVisible(true);
  }, []);

  // Handle copy - show checkmark briefly instead of popup
  const handleCopy = useCallback((address) => {
    Clipboard.setString(address.address);
    
    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    
    // Show checkmark for this address
    setCopiedAddressId(address.id);
    
    // Reset after 1.5 seconds
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedAddressId(null);
    }, 1500);
  }, []);

  // Handle delete
  const handleDelete = useCallback((address, event) => {
    // Stop event propagation to prevent card press
    if (event) {
      event.stopPropagation();
    }
    
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete "${address.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAddressFromBook(address.id, accountHash);
            } catch (e) {
              console.warn('Failed to delete address:', e);
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  }, [accountHash]);

  // Handle save from edit sheet
  const handleSave = useCallback(async (data) => {
    if (editingAddress) {
      // Update existing
      await updateAddressInBook(
        editingAddress.id,
        { label: data.label },
        accountHash
      );
    } else {
      // Add new
      await saveAddressToBook(
        { address: data.address, label: data.label, type: data.type },
        accountHash
      );
    }
  }, [editingAddress, accountHash]);

  // Scroll handler for header divider
  const handleScroll = useCallback((event) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    setShowHeaderDivider(y > 1);
  }, []);

  const hasAddresses = addresses && addresses.length > 0;
  const addressCount = addresses?.length || 0;
  const showFiltersAndSearch = addressCount >= 6;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, showHeaderDivider && styles.headerScrolled]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Address book</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleAddNew}
              hitSlop={iconHitSlop}
              style={styles.headerIconButton}
            >
              <MaterialCommunityIcons
                name="plus"
                size={20}
                color={Colors.verusDarkGray}
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Filter tabs - only show when 6+ addresses */}
        {hasAddresses && showFiltersAndSearch && (
          <View style={styles.filterContainer}>
            {FILTER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.filterTab,
                  activeFilter === option.id && styles.filterTabActive,
                ]}
                onPress={() => setActiveFilter(option.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeFilter === option.id && styles.filterTabTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Search bar - only show when 6+ addresses */}
        {hasAddresses && showFiltersAndSearch && (
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
              placeholder="Search addresses"
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
        )}
      </View>

      {/* Content */}
      {!hasAddresses ? (
        // Empty state
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={80}
              color="#E0E0E0"
            />
          </View>
          <Text style={styles.emptyTitle}>No saved addresses</Text>
          <Text style={styles.emptyDescription}>
            Save frequently used addresses for quick access when sending
          </Text>
          <GradientButton
            onPress={handleAddNew}
            style={styles.emptyPrimaryCta}
            labelStyle={{ marginTop: -1 }}
          >
            Add your first address
          </GradientButton>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 80 },
            ]}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
            {filteredAddresses.length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>
                  {searchQuery.trim()
                    ? 'No addresses match your search'
                    : 'No addresses in this category'}
                </Text>
              </View>
            ) : (
              filteredAddresses.map((item) => {
                const isCopied = copiedAddressId === item.id;
                const coinTicker = ADDRESS_TYPE_TO_TICKER[item.type] || 'VRSC';
                
                return (
                  <View
                    key={item.id}
                    style={styles.addressCard}
                  >
                    {/* Coin icon at start of row */}
                    <View style={styles.coinIconContainer}>
                      {RenderPlainCoinLogo(coinTicker, {}, 28, 28)}
                    </View>
                    
                    <View style={styles.addressContent}>
                      <Text style={styles.labelText} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={styles.addressText} numberOfLines={1}>
                        {truncateAddress(item.address, 8, 8)}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleCopy(item)}
                        hitSlop={iconHitSlop}
                      >
                        <MaterialCommunityIcons 
                          name={isCopied ? "check" : "content-copy"}
                          size={18} 
                          color={isCopied ? Colors.verusGreenColor : Colors.verusDarkGray} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEdit(item)}
                        hitSlop={iconHitSlop}
                      >
                        <MaterialCommunityIcons 
                          name="pencil-outline" 
                          size={18} 
                          color={Colors.verusDarkGray} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => handleDelete(item, e)}
                        hitSlop={iconHitSlop}
                      >
                        <MaterialCommunityIcons 
                          name="trash-can-outline" 
                          size={18} 
                          color={Colors.verusDarkGray} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}

      {/* Edit/Add sheet */}
      <AddressBookEditSheet
        visible={editSheetVisible}
        onClose={() => {
          setEditSheetVisible(false);
          setEditingAddress(null);
        }}
        onSave={handleSave}
        initialAddress={editingAddress?.address || ''}
        initialLabel={editingAddress?.label || ''}
        editMode={!!editingAddress}
        addressId={editingAddress?.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: 'white',
  },
  headerScrolled: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E4EA',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconButton: {
    padding: 6,
  },
  filterContainer: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  filterTabActive: {
    backgroundColor: Colors.primaryColor,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: Colors.secondaryColor,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    height: 48,
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
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  searchIcon: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  coinIconContainer: {
    marginRight: 12,
  },
  addressContent: {
    flex: 1,
  },
  labelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    color: '#888',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
  // Empty State - Match Identity Home styling
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 170,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.quinaryColor,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    color: Colors.verusDarkGray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  // Match Wallet/Identity 'primary' button style: 240x44, radius 22
  emptyPrimaryCta: {
    width: 240,
    height: 44,
    borderRadius: 22,
    marginBottom: 16,
  },
  // Match Identity secondary button styling (outlined pill)
  emptySecondaryCta: {
    width: 200,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF6FF',
    marginBottom: 16,
    borderWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  emptySecondaryLabel: {
    color: Colors.primaryColor,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0,
    textTransform: 'none',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  noResultsText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});

export default AddressBook;
