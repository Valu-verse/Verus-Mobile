/*
  New file: ReceiveSubwalletSheet
  - Bottom sheet for selecting a subwallet before generating a receive request
  - Reuses SemiModal layout with compact wallet list items
*/

import React from 'react';
import { View } from 'react-native';
import { Portal, List, Button, Text } from 'react-native-paper';
import Colors from '../../globals/colors';
import SemiModal from '../../components/SemiModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeNum } from '../../utils/normalizeNum';

const ReceiveSubwalletSheet = ({
  visible,
  coinObj,
  subWallets,
  balanceMap = {},
  onClose,
  onSelect,
}) => {
  if (!visible || coinObj == null) return null;

  const insets = useSafeAreaInsets();
  const paddingBottom = 20 + insets.bottom;
  const displayTicker = coinObj?.display_ticker || coinObj?.id || '';
  const decimals = coinObj?.decimals != null ? coinObj.decimals : 8;

  const formatBalance = (walletId) => {
    const raw = Number(balanceMap?.[walletId] ?? 0);
    const normalized = normalizeNum(raw, Math.min(decimals, 8));
    if (Array.isArray(normalized) && normalized.length > 3) return normalized[3];
    return raw.toString();
  };

  const handleSelect = (wallet) => {
    if (typeof onSelect === 'function') {
      onSelect(wallet);
    }
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
        }}
      >
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
              paddingBottom: 12,
            }}
          >
            <Button onPress={onClose} textColor={Colors.primaryColor}>
              {'Close'}
            </Button>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{'Choose address'}</Text>
            <View style={{ width: 64 }} />
          </View>

          <View style={{ paddingHorizontal: 12 }}>
            {subWallets.map((wallet) => {
              const displayName = wallet.name || wallet.address || wallet.id;
              const balanceString = formatBalance(wallet.id);

              return (
                <View
                  key={wallet.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    marginBottom: 12,
                  }}
                >
                  <List.Item
                    title={() => (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '500', color: 'black' }}>
                          {displayName}
                        </Text>
                        <View
                          style={{
                            marginLeft: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                            backgroundColor: '#E8F5E9',
                            borderWidth: 1,
                            borderColor: '#D6E9DB',
                          }}
                        >
                          <Text style={{ fontSize: 10, color: Colors.verusGreenColor, fontWeight: '600' }}>
                            {'My wallet'}
                          </Text>
                        </View>
                      </View>
                    )}
                    description={() => (
                      <Text style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
                        {'Current: ' + balanceString + ' ' + displayTicker}
                      </Text>
                    )}
                    onPress={() => handleSelect(wallet)}
                    left={(props) => <List.Icon {...props} icon="wallet" color={'black'} />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                    titleStyle={{ fontSize: 16, fontWeight: '600', color: 'black' }}
                    descriptionStyle={{ fontSize: 12, color: '#666', marginTop: 4 }}
                    style={{ backgroundColor: 'transparent', paddingVertical: 8 }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </SemiModal>
    </Portal>
  );
};

export default ReceiveSubwalletSheet;


