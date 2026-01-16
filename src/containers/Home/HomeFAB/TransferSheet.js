/*
  New file: TransferSheet
  - Bottom sheet surfaced from the Transfer button (Home/Assets FAB row)
  - Presents two primary actions: "Receive crypto" and "Send & convert assets"
  - 2026-01-12: Standardized header close affordance to shared SemiModal header (top-right X).
*/

import React from 'react';
import { View } from 'react-native';
import { Portal, List } from 'react-native-paper';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const noop = () => {};

const TransferSheet = ({
  visible,
  onClose,
  onSelectReceive,
  onSelectSendConvert,
}) => {
  if (!visible) return null;

  const insets = useSafeAreaInsets();
  const paddingBottom = 12 + insets.bottom;

  const handleReceive = () => {
    onClose();
    (onSelectReceive || noop)();
  };

  const handleSendConvert = () => {
    onClose();
    (onSelectSendConvert || noop)();
  };

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        title="Transfer"
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
          <View style={{ paddingHorizontal: 12 }}>
            <List.Item
              title="Receive crypto"
              description="Receive assets or make payment requests"
              onPress={handleReceive}
              left={(props) => <List.Icon {...props} icon="arrow-bottom-left" color={'black'} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={{
                backgroundColor: 'white',
                borderRadius: 12,
                marginBottom: 12,
                paddingVertical: 8,
              }}
            />

            <List.Item
              title="Send or convert crypto"
              description="Send assets out or convert between assets"
              onPress={handleSendConvert}
              left={(props) => <List.Icon {...props} icon="arrow-top-right" color={'black'} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={{
                backgroundColor: 'white',
                borderRadius: 12,
                paddingVertical: 8,
              }}
            />
          </View>
        </View>
      </SemiModal>
    </Portal>
  );
};

export default TransferSheet;


