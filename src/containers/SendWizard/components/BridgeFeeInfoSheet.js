/*
  BridgeFeeInfoSheet
  - 2026-01-21: Created. Info sheet explaining why bridge transaction fees are higher.
    Displays when user taps the "?" icon next to "Network fee" on the confirmation screen
    for Ethereum <-> Verus bridge transactions.
*/
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import GradientButton from '../../../components/GradientButton';

const BridgeFeeInfoSheet = ({ visible, onClose, isToEthereum }) => {
  return (
    <SemiModal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      title={isToEthereum ? "Why is the network fee higher?" : "Why is the network fee higher?"}
      flexHeight={0.01}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.sheetBody}>
        <Text style={styles.paragraph}>
          {isToEthereum 
            ? "This is the Verus network fee to process your transaction. Unlike other bridges, Verus charges no bridge markup or additional fees."
            : "This fee goes to Ethereum validators to process your transaction. Unlike other bridges, Verus charges no bridge markup or additional fees."
          }
        </Text>
        <Text style={styles.paragraph}>
          {isToEthereum
            ? "When your funds arrive on Ethereum, you'll pay the standard Ethereum gas fee. This covers the cost of importing your transaction into the Ethereum blockchain."
            : "When your funds arrive on Verus, you'll pay a standard Verus network fee. This covers the cost of importing your transaction into the blockchain."
          }
        </Text>

        <GradientButton
          onPress={onClose}
        >
          {'Got it'}
        </GradientButton>
      </View>
    </SemiModal>
  );
};

const styles = StyleSheet.create({
  sheetContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flex: 0,
    alignSelf: 'flex-end',
    width: '100%',
    backgroundColor: 'white',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  paragraph: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    marginBottom: 14,
  },
});

export default BridgeFeeInfoSheet;
