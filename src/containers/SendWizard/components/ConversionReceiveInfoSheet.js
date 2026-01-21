/*
  ConversionReceiveInfoSheet
  - Displays when user taps the "?" icon next to "You'll receive approximately"
  - Explains that the received amount is an estimate and not fixed
*/
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SemiModal from '../../../components/SemiModal';
import GradientButton from '../../../components/GradientButton';

const ConversionReceiveInfoSheet = ({ visible, onClose }) => {
  return (
    <SemiModal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      title="Estimated Amount"
      flexHeight={0.01}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.sheetBody}>
        <Text style={styles.paragraph}>
          Your final price is calculated when your conversion is included in a block. All conversions in that block are processed together, which means everyone gets the same fair price.
        </Text>
        <Text style={styles.paragraph}>
          This is why the estimate may differ slightly from your actual result.
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
    paddingTop: 10,
  },
  paragraph: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    marginBottom: 16,
  },
});

export default ConversionReceiveInfoSheet;
