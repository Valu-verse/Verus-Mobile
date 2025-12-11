/*
  SendSelfAddressSheet
  - Bottom sheet for selecting own address for "Send to self"
  - Shows user's available addresses filtered by address type
  - Styled after BuySellSheet pattern
  - Created 2024-12-09
  - Updated 2024-12-09: Added addressType prop for better descriptions
*/

import React from 'react';
import { View, Platform } from 'react-native';
import { Portal, List, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const paddingBottom = 12 + insets.bottom;

  if (!visible) return null;

  // Truncate address for display
  const truncateAddress = (addr) => {
    if (!addr || addr.length <= 16) return addr;
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}`;
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
              paddingBottom: 16,
            }}
          >
            <Button onPress={onClose} textColor={Colors.primaryColor}>
              {'Close'}
            </Button>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{'Your addresses'}</Text>
            <View style={{ width: 64 }} />
          </View>

          {/* Description */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={{ fontSize: 14, color: '#666', lineHeight: 20 }}>
              Select one of your {addressType === ADDRESS_TYPE.ETHEREUM ? 'Ethereum' : 'Verus'} addresses to send to yourself.
            </Text>
          </View>

          {/* Addresses list */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            {addresses.map((item, index) => (
              <List.Item
                key={item.id || item.address || index}
                onPress={() => onSelect(item.address)}
                left={(props) => (
                  <List.Icon 
                    {...props} 
                    icon={addressType === ADDRESS_TYPE.ETHEREUM ? 'ethereum' : 'wallet'} 
                    color="black" 
                  />
                )}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                title={() => (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: 'black' }}>
                    {item.name || 'My address'}
                  </Text>
                )}
                description={() => (
                  <Text style={{ fontSize: 13, color: '#666', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                    {truncateAddress(item.address)}
                  </Text>
                )}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  marginBottom: 12,
                  paddingVertical: 8,
                }}
              />
            ))}
          </View>
        </View>
      </SemiModal>
    </Portal>
  );
};

export default SendSelfAddressSheet;

