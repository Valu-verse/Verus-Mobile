/*
  SendSourceSubwalletSheet
  - Bottom sheet for selecting a subwallet when sending
  - Groups wallets by network with network as category header
  - Address/ID and amount shown as equally prominent
  - Created 2024-12-09
  - Updated 2024-12-10: Network as category header, address/amount equally prominent
*/

import React, { useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Portal, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import { getNetworkDisplayName, getNetworkIcon } from '../sendWizardDisplayInfo';
import { RenderSquareCoinLogo } from '../../../utils/CoinData/Graphics';

const SendSourceSubwalletSheet = ({
  visible,
  coinObj,
  subWallets,
  balanceMap,
  onClose,
  onSelect,
}) => {
  const insets = useSafeAreaInsets();
  const paddingBottom = 16 + insets.bottom;

  // Group wallets by network
  const groupedByNetwork = useMemo(() => {
    const groups = new Map();
    
    subWallets.forEach((wallet) => {
      const networkId = wallet.network || 'unknown';
      if (!groups.has(networkId)) {
        groups.set(networkId, {
          networkId,
          networkName: getNetworkDisplayName(networkId, 'Unknown Network'),
          networkIcon: getNetworkIcon(networkId),
          wallets: [],
        });
      }
      groups.get(networkId).wallets.push(wallet);
    });
    
    return Array.from(groups.values());
  }, [subWallets]);

  if (!visible || !coinObj) return null;

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
              {'Close'}
            </Button>
            <Text style={styles.headerTitle}>{'Select source'}</Text>
            <View style={{ width: 64 }} />
          </View>

          {/* Description */}
          <View style={styles.description}>
            <Text style={styles.descriptionText}>
              Your {coinObj.display_ticker} is on multiple networks. Select where to send from.
            </Text>
          </View>

          {/* Grouped wallet list */}
          <ScrollView style={{ maxHeight: 400 }}>
            <View style={styles.listContainer}>
              {groupedByNetwork.map((group) => (
                <View key={group.networkId} style={styles.networkGroup}>
                  {/* Network header */}
                  <View style={styles.networkHeader}>
                    <View style={styles.networkIconContainer}>
                      {RenderSquareCoinLogo(group.networkIcon || 'VRSC', {}, 24, 24)}
                    </View>
                    <Text style={styles.networkHeaderText}>{group.networkName}</Text>
                  </View>
                  
                  {/* Wallets in this network */}
                  {group.wallets.map((wallet) => {
                    const balance = balanceMap[wallet.id] || 0;
                    const balanceFormatted = Number(balance).toFixed(4);
                    
                    // Extract address/ID from wallet
                    const addressDisplay = wallet.name || wallet.id;
                    
                    return (
                      <TouchableOpacity
                        key={wallet.id}
                        style={styles.walletCard}
                        onPress={() => onSelect(wallet)}
                        activeOpacity={0.7}
                      >
                        {/* Left: Address/ID */}
                        <View style={styles.addressSection}>
                          <Text style={styles.addressText} numberOfLines={1}>
                            {addressDisplay}
                          </Text>
                        </View>

                        {/* Right: Balance */}
                        <View style={styles.balanceSection}>
                          <Text style={styles.balanceAmount}>
                            {balanceFormatted}
                          </Text>
                          <Text style={styles.balanceTicker}>
                            {coinObj.display_ticker}
                          </Text>
                        </View>

                        <MaterialCommunityIcons 
                          name="chevron-right" 
                          size={20} 
                          color="#CCC" 
                          style={styles.chevron}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
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
  // Network group
  networkGroup: {
    marginBottom: 20,
  },
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  networkIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  networkHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Wallet card
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  balanceSection: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  balanceTicker: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  chevron: {
    marginLeft: 4,
  },
});

export default SendSourceSubwalletSheet;
