/*
  FeesInfoSheet
  - Displays detailed fee breakdown when user taps the fees row
  - Shows network fee and conversion fee with amounts and fiat values
  - Removed subtitle descriptions under fee labels for cleaner UI
  - Fixed alignment when only one fee is shown by removing divider and adding proper spacing
  - Updated 2026-01-22
*/
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SemiModal from '../../../components/SemiModal';
import GradientButton from '../../../components/GradientButton';

const FeesInfoSheet = ({
  visible,
  onClose,
  networkFee,
  networkFeeCurrency,
  networkFeeFiat,
  conversionFee,
  conversionFeeCurrency,
  conversionFeePercentage,
  conversionFeeFiat,
}) => {
  const hasConversionFee = conversionFee && parseFloat(conversionFee) > 0;

  return (
    <SemiModal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      title="Fee Breakdown"
      flexHeight={0.01}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.sheetBody}>
        {/* Network Fee */}
        <View style={[styles.feeRow, !hasConversionFee && styles.feeRowLast]}>
          <View style={styles.feeLeft}>
            <Text style={styles.feeLabel}>Network fee</Text>
          </View>
          <View style={styles.feeRight}>
            <Text style={styles.feeAmount}>{networkFee} {networkFeeCurrency}</Text>
            {networkFeeFiat && (
              <Text style={styles.feeFiat}>{networkFeeFiat}</Text>
            )}
          </View>
        </View>

        {/* Conversion Fee */}
        {hasConversionFee && (
          <View style={[styles.feeRow, styles.feeRowLast]}>
            <View style={styles.feeLeft}>
              <Text style={styles.feeLabel}>Conversion fee ({conversionFeePercentage})</Text>
            </View>
            <View style={styles.feeRight}>
              <Text style={styles.feeAmount}>{conversionFee} {conversionFeeCurrency}</Text>
              {conversionFeeFiat && (
                <Text style={styles.feeFiat}>{conversionFeeFiat}</Text>
              )}
            </View>
          </View>
        )}

        <GradientButton onPress={onClose}>
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
    paddingTop: 8,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  feeRowLast: {
    borderBottomWidth: 0,
    marginBottom: 24,
  },
  feeLeft: {
    flex: 1,
  },
  feeRight: {
    alignItems: 'flex-end',
  },
  feeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  feeAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  feeFiat: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});

export default FeesInfoSheet;
