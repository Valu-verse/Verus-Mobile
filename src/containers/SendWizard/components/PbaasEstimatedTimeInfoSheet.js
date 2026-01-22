/*
  PbaasEstimatedTimeInfoSheet
  - Displays when user taps the hourglass icon next to "Estimated time"
  - Explains why PBaaS conversions take 2-10 minutes (bundling, fair price)
*/
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SemiModal from '../../../components/SemiModal';
import GradientButton from '../../../components/GradientButton';

const PbaasEstimatedTimeInfoSheet = ({ visible, onClose }) => {
  return (
    <SemiModal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      title="Why 2-10 minutes?"
      flexHeight={0.01}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.sheetBody}>
        <Text style={styles.paragraph}>
          Conversions take 2-10 blocks to complete, this is on average within 2-10 minutes. Your conversion is bundled with all other conversions and solved together.
        </Text>
        <Text style={styles.paragraph}>
          This bundling is what prevents front-running and ensures everyone gets the same fair price.
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

export default PbaasEstimatedTimeInfoSheet;
