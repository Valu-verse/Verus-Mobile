/*
  ImportWalletSheet (bottom sheet choices)
  - Presents options to import wallet: 24-word seed, Scan QR, Enter key/seed text
  - Uses SemiModal with the same styling as BuySellSheet choices
*/
import React from 'react';
import { View } from 'react-native';
import { Portal, List, Button, Text } from 'react-native-paper';
import SemiModal from '../../../../../components/SemiModal';
import Colors from '../../../../../globals/colors';

export default function ImportWalletSheet({ visible, onClose, onSelect }) {
  if (!visible) return null;

  return (
    <Portal>
      <SemiModal
        animationType={'slide'}
        transparent={true}
        visible={true}
        onRequestClose={onClose}
        flexHeight={0.01}
        contentContainerStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flex: 0,
          alignSelf: 'flex-end',
          width: '100%',
          maxHeight: '70%'
        }}
      >
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 16 }}>
            <Button onPress={onClose} textColor={Colors.primaryColor}>{'Close'}</Button>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{'Import your wallet'}</Text>
            <View style={{ width: 64 }} />
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 }}>
              {'Choose how you want to bring an existing wallet into this profile.'}
            </Text>
            <List.Item
              title={'Import 24‑word seed'}
              description={'Enter your recovery phrase'}
              onPress={() => onSelect && onSelect('ImportSeed')}
              left={(props) => <List.Icon {...props} icon={'script-text-outline'} color={'black'} />}
              right={(props) => <List.Icon {...props} icon={'chevron-right'} />}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
            />
            <List.Item
              title={'Scan QR code'}
              description={'Scan a private key QR to import'}
              onPress={() => onSelect && onSelect('ScanQr')}
              left={(props) => <List.Icon {...props} icon={'qrcode-scan'} color={'black'} />}
              right={(props) => <List.Icon {...props} icon={'chevron-right'} />}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
            />
            <List.Item
              title={'Enter key or seed text'}
              description={'Paste a private key or seed manually'}
              onPress={() => onSelect && onSelect('ImportText')}
              left={(props) => <List.Icon {...props} icon={'key-variant'} color={'black'} />}
              right={(props) => <List.Icon {...props} icon={'chevron-right'} />}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
            />
          </View>
        </View>
      </SemiModal>
    </Portal>
  );
}


