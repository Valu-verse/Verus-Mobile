/*
  BridgeEstimatedTimeInfoSheet
  - 2026-01-21: Created. Info sheet explaining why bridge transactions take 1-3 hours.
    Displays when user taps the "?" icon next to "Estimated time" on the confirmation screen
    for Ethereum <-> Verus bridge transactions.
*/
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import GradientButton from '../../../components/GradientButton';

const BridgeEstimatedTimeInfoSheet = ({ visible, onClose, isToEthereum }) => {
  return (
    <SemiModal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      title="Why does this take 1-3 hours?"
      flexHeight={0.01}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.sheetBody}>
        <Text style={styles.paragraph}>
          {isToEthereum
            ? "Your transaction is confirmed on Verus, then verified through the decentralized notarization process. Verus miners, stakers, and community witnesses create cryptographic proofs before your funds appear on Ethereum. This extra time eliminates the security risks common in other bridges."
            : "Your transaction needs verification from Verus miners, stakers, and community witnesses. This extra time eliminates the security risks common in other bridges."
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
    marginBottom: 24,
  },
});

export default BridgeEstimatedTimeInfoSheet;
