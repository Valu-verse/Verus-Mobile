/*
  Updated file: ValuPaymentMethodSheet
  - Shared semi-modal sheet for selecting on/off-ramp payment providers
  - Displays provider, fee percentage, and min/max limits with consistent styling
  - Uses normalized labels and provider-specific icons (SVG or Material icons)
  - Used by both ValuOnRampChooseSource and ValuOffRampChooseSource flows
*/

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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

const ICON_WIDTH = 58;
const ICON_HEIGHT = 40;
const ICON_BORDER_RADIUS = 4.5;

const renderOptionIcon = (iconMeta) => {
  if (!iconMeta) return null;

  if (iconMeta.type === 'svg' && iconMeta.Component) {
    const SvgIcon = iconMeta.Component;

    return (
      <View style={styles.optionSvgWrapper}>
        <SvgIcon width={ICON_WIDTH} height={ICON_HEIGHT} />
      </View>
    );
  }

  return (
    <View style={styles.optionIconWrapper}>
      <MaterialCommunityIcons
        name={iconMeta.name || 'credit-card-outline'}
        size={26}
        color={iconMeta.color || '#1A1A1A'}
      />
    </View>
  );
};

// buildLimitLabel removed - no longer showing limits in the sheet

const ValuPaymentMethodSheet = ({
  visible,
  onDismiss,
  options = [],
  selectedIndex = null,
  currency = 'USD',
  title = null,
  mode = 'buy',
  onSelect,
}) => {
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
              const networkFeeFormatted = currencyFormatter(option?.networkFeeFiat, currency);
              const serviceFeePercentageRaw =
                option?.serviceFeePercentage != null
                  ? option.serviceFeePercentage
                  : option?.feePercentage;
              const serviceFeeFormatted =
                serviceFeePercentageRaw != null && !Number.isNaN(Number(serviceFeePercentageRaw))
                  ? `${Number(serviceFeePercentageRaw).toFixed(1)}%`
                  : null;
              const feeDisplay =
                networkFeeFormatted || serviceFeeFormatted
                  ? `Fee: ${networkFeeFormatted || '—'} + ${serviceFeeFormatted || '—'}`
                  : 'Fee unavailable';

              return (
                <TouchableOpacity
                  key={`${option?.paymentMethod || 'method'}-${index}`}
                  onPress={() => handleSelect(option, index)}
                  activeOpacity={0.7}
                  style={styles.optionRowFlat}
                >
                  {renderOptionIcon(meta.icon)}
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
  optionIconWrapper: {
    width: ICON_WIDTH,
    height: ICON_HEIGHT,
    borderRadius: ICON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: '#F2F4F7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionSvgWrapper: {
    width: ICON_WIDTH,
    height: ICON_HEIGHT,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
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

