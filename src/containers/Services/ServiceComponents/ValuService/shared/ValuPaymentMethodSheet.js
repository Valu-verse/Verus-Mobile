/*
  New file: ValuPaymentMethodSheet
  - Shared semi-modal sheet for selecting on/off-ramp payment providers
  - Displays provider, fee percentage, and min/max limits with consistent styling
  - Used by both ValuOnRampChooseSource and ValuOffRampChooseSource flows
*/

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Portal, Button, List, Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import SemiModal from '../../../../../components/SemiModal';
import Colors from '../../../../../globals/colors';

const currencyFormatter = (amount, code) => {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  try {
    const formatted = formatCurrency({
      amount: Number(amount).toFixed(2),
      code: code || 'USD',
    });
    return formatted?.[1] || null;
  } catch (e) {
    // Fallback simple formatting
    return `${Number(amount).toFixed(2)} ${code || ''}`.trim();
  }
};

// buildLimitLabel removed - no longer showing limits in the sheet

const ValuPaymentMethodSheet = ({
  visible,
  onDismiss,
  options = [],
  selectedIndex = null,
  currency = 'USD',
  title = 'Select payment method',
  mode = 'buy',
  onSelect,
}) => {
  if (!visible) return null;

  const handleSelect = (option, index) => {
    if (typeof onSelect === 'function') {
      onSelect(option, index);
    }
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  };

  const emptyState =
    !options || options.length === 0 ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateTitle}>No payment methods</Text>
        <Text style={styles.emptyStateBody}>
          We could not load any {mode === 'sell' ? 'payout' : 'payment'} options right now. Please try again in a moment.
        </Text>
      </View>
    ) : null;

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={true}
        onRequestClose={onDismiss}
        flexHeight={0.01}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.header}>
          <Button textColor={Colors.primaryColor} onPress={onDismiss}>
            Close
          </Button>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 64 }} />
        </View>

        {emptyState || (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {options.map((option, index) => {
              const isSelected = selectedIndex === index;
              const feePercentage =
                option?.feePercentage != null && !Number.isNaN(Number(option.feePercentage))
                  ? `${Number(option.feePercentage).toFixed(1)}% fee`
                  : 'Fee unavailable';

              return (
                <TouchableOpacity
                  key={`${option?.paymentMethod || 'method'}-${index}`}
                  onPress={() => handleSelect(option, index)}
                  activeOpacity={0.7}
                  style={styles.optionRowFlat}
                >
                  <MaterialCommunityIcons 
                    name="credit-card-outline" 
                    size={24} 
                    color="#000" 
                    style={{ marginRight: 12 }} 
                  />
                  <View style={styles.optionTextColumn}>
                    <Text style={styles.optionLabel}>
                      {option?.paymentMethod || 'Payment method'}
                    </Text>
                    <Text style={styles.optionValue}>{feePercentage}</Text>
                  </View>
                  <MaterialCommunityIcons 
                    name={isSelected ? 'check-circle' : 'chevron-right'} 
                    size={24} 
                    color={isSelected ? Colors.primaryColor : '#888'} 
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </SemiModal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignSelf: 'flex-end',
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scrollContainer: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  optionRowFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  optionTextColumn: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  optionValue: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(26, 26, 26, 0.7)',
  },
  emptyState: {
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyStateBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default ValuPaymentMethodSheet;

