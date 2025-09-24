/*
  New file: ManageAssetsSheet
  - Bottom sheet modal for Home "Manage assets" actions using SemiModal (matches Buy/Sell sheet style)
  - Presents large, card-like options with icons and chevrons
  - Auto-closes after an option is selected and fires the provided handlers
  - Important: Close sheet first, then open destination modal (next tick) to avoid
    modal stack race conditions that can leave only a dark overlay visible
*/
import React from 'react';
import { View, Image } from 'react-native';
import { Portal, List, Button, Text } from 'react-native-paper';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';

const ManageAssetsSheet = ({
  visible,
  onClose,
  showConfigureHomeCards,
  onBrowseAll,
  onAddErc20,
  onAddPbaas,
  onArrangeCards,
}) => {
  if (!visible) return null;

  const handleAndClose = (fn) => {
    // Close this sheet first, then open the next modal on the next tick to avoid
    // overlapping NativeModals and Portal ordering issues.
    onClose && onClose();
    setTimeout(() => {
      if (typeof fn === 'function') fn();
    }, 0);
  };

  return (
    <Portal>
      <SemiModal
        animationType="slide"
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
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 16 }}>
            <Button onPress={onClose} textColor={Colors.primaryColor}>{'Close'}</Button>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{'Manage assets'}</Text>
            <View style={{ width: 64 }} />
          </View>

          {/* Options */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {/* 1) Verus ecosystem */}
            <List.Item
              title="Add ecosystem currency"
              description="Add currencies and coins from the Verus ecosystem"
              onPress={() => handleAndClose(onAddPbaas)}
              left={(props) => (
                <View style={[props.style, { width: 40, alignItems: 'center', justifyContent: 'center' }]}>
                  <Image
                    source={require('../../../images/customIcons/Verus.png')}
                    style={{ width: 24, height: 24, resizeMode: 'contain' }}
                  />
                </View>
              )}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
            />

            {/* 2) Browse assets */}
            <List.Item
              title="Browse assets"
              description="Enable or disable assets in your wallet"
              onPress={() => handleAndClose(onBrowseAll)}
              left={(props) => (
                <List.Icon {...props} icon="format-list-bulleted" color={'black'} />
              )}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
            />

            {/* 3) Add ERC-20 token */}
            <List.Item
              title="Add ERC-20 token"
              description="Add by contract address on Ethereum"
              onPress={() => handleAndClose(onAddErc20)}
              left={(props) => (
                <List.Icon {...props} icon="ethereum" color={'black'} />
              )}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
              descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
              style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
            />

            {showConfigureHomeCards && (
              <List.Item
                title="Arrange cards"
                description="Reorder your home cards"
                onPress={() => handleAndClose(onArrangeCards)}
                left={(props) => (
                  <List.Icon {...props} icon="swap-horizontal-variant" color={'black'} />
                )}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                titleStyle={{ fontSize: 18, fontWeight: '600', color: 'black' }}
                descriptionStyle={{ fontSize: 14, color: '#666', marginTop: 6 }}
                style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingVertical: 8 }}
              />
            )}
          </View>
        </View>
      </SemiModal>
    </Portal>
  );
};

export default ManageAssetsSheet;


