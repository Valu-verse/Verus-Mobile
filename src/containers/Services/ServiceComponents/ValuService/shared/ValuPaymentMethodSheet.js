/*
  Updated file: ValuPaymentMethodSheet
  - Shared semi-modal sheet for selecting on/off-ramp payment providers
  - Displays provider, fee percentage, and min/max limits with consistent styling
  - Uses normalized labels and provider-specific icons (SVG or Material icons)
  - Simplified icons to generic credit card
  - Uses bank icon for SEPA/SPEI/SWIFT payment options
  - Supports Apple Pay SVG icon
  - Adjusted fee text size and capitalization
  - Used by both ValuOnRampChooseSource and ValuOffRampChooseSource flows
*/

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Portal, Button, Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import SemiModal from '../../../../../components/SemiModal';
import Colors from '../../../../../globals/colors';
import {
  getPaymentMethodMeta,
  normalizePaymentMethodLabel,
} from './valuPaymentMethodMeta';

const currencyFormatter = (amount, code) => {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  try {
    const formatted = formatCurrency({
      amount: Number(amount).toFixed(2),
      code: code || 'USD',
    });
    return formatted?.[0] || null;
  } catch (e) {
    // Fallback simple formatting
    return `${code || ''}${Number(amount).toFixed(2)}`.trim();
  }
};

const BANK_ICON_LABELS = new Set([
  'SEPA bank transfer',
  'SPEI',
  'SWIFT bank transfer',
]);

const renderOptionIcon = (iconConfig) => {
  if (iconConfig?.type === 'svg' && iconConfig.Component) {
    const SvgIcon = iconConfig.Component;
    return (
      <View style={styles.optionSvgWrapper}>
        <SvgIcon width={32} height={16} preserveAspectRatio="xMidYMid meet" />
      </View>
    );
  }
  if (iconConfig?.type === 'image' && iconConfig.source) {
    return (
      <View style={styles.optionImageWrapper}>
        <Image source={iconConfig.source} style={styles.optionImage} resizeMode="contain" />
      </View>
    );
  }

  const iconName = iconConfig?.name || 'credit-card-outline';

  return (
    <View style={styles.optionIconWrapperSimple}>
      <MaterialCommunityIcons
        name={iconName}
        size={24}
        color={iconConfig?.color || '#1A1A1A'}
      />
    </View>
  );
};

// buildLimitLabel removed - no longer showing limits in the sheet

const ValuPaymentMethodSheet = (props) => {
  const {
    visible,
    onDismiss,
    options = [],
    selectedIndex = null,
    currency = 'USD',
    title = null,
    mode = 'buy',
    onSelect,
  } = props;
  if (!visible) return null;

  const sheetTitle = title || (mode === 'sell' ? 'Select payout method' : 'Select payment method');

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
        <Text style={styles.emptyStateTitle}>{mode === 'sell' ? 'No payout methods' : 'No payment methods'}</Text>
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
          <Text style={styles.headerTitle}>{sheetTitle}</Text>
          <View style={{ width: 64 }} />
        </View>

        {emptyState || (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {options.map((option, index) => {
              const meta = getPaymentMethodMeta(option?.paymentMethod);
              const displayLabel =
                meta.label || normalizePaymentMethodLabel(option?.paymentMethod) || 'Payment method';
              const isSelected = selectedIndex === index;
              let iconConfig = meta.icon;
              if (BANK_ICON_LABELS.has(displayLabel)) {
                iconConfig = {
                  type: 'mcicon',
                  name: 'bank',
                  color: '#1A1A1A',
                };
              }
              
              // Calculate Total Fee
              const amountNum = Number(props.amount) || 0;
              const networkFee = Number(option?.networkFeeFiat) || 0;
              const bankFee = Number(option?.payoutfee) || 0;
              
              let serviceFee = Number(option?.serviceFeeFiat) || 0;
              
              // If service fee fiat is not provided, try to calculate from percentage
              if (!serviceFee) {
                const serviceFeePercent = Number(option?.serviceFeePercentage) || Number(option?.feePercentage) || 0;
                if (serviceFeePercent > 0) {
                  // Calculate gross fee based on percentage
                  const grossFee = amountNum * (serviceFeePercent / 100);
                  // Net service fee is gross fee minus network fee (clamped to 0)
                  serviceFee = Math.max(grossFee - networkFee, 0);
                }
              }
              
              const totalFee = networkFee + serviceFee + bankFee;
              const formattedTotalFee = currencyFormatter(totalFee, currency);
              
              const feeDisplay = formattedTotalFee 
                ? `${formattedTotalFee} fee`
                : 'Fee unavailable';

              return (
                <TouchableOpacity
                  key={`${option?.paymentMethod || 'method'}-${index}`}
                  onPress={() => handleSelect(option, index)}
                  activeOpacity={0.7}
                  style={styles.optionRowFlat}
                >
                  {renderOptionIcon(iconConfig)}
                  <View style={styles.optionTextColumn}>
                    <Text style={styles.optionLabel}>
                      {displayLabel}
                    </Text>
                    <Text style={styles.optionValue}>{feeDisplay}</Text>
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
  optionIconWrapperSimple: {
    width: 32,
    height: 32,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionSvgWrapper: {
    width: 32,
    height: 32,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionImageWrapper: {
    width: 32,
    height: 32,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionImage: {
    width: 32,
    height: 16,
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
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    lineHeight: 18,
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

