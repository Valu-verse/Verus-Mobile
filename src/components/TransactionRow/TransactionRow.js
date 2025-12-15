/*
  TransactionRow Component
  2025-12-15: Created modern transaction list item with:
  - Smaller icons (18px) in colored circular backgrounds
  - Primary text: Transaction type + truncated address
  - Secondary text: Relative timestamp
  - Right side: Amount with +/- indicator and fiat equivalent
  - Pending status indicator
  - Semantic colors: green (received), red (sent), amber (pending)
*/

import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import BigNumber from 'bignumber.js';
import Colors from '../../globals/colors';
import { truncateDecimal, unixToRelativeTime, scientificToDecimal } from '../../utils/math';
import { formatCurrency } from 'react-native-format-currency';

// Transaction type configurations
const TX_CONFIG = {
  received: {
    icon: 'arrow-down',
    backgroundColor: '#E8F5E9',
    iconColor: '#2E7D32',
    amountPrefix: '+',
    amountColor: '#2E7D32',
    label: 'Received',
  },
  sent: {
    icon: 'arrow-up',
    backgroundColor: '#FFEBEE',
    iconColor: '#C62828',
    amountPrefix: '-',
    amountColor: '#C62828',
    label: 'Sent to',
  },
  self: {
    icon: 'swap-horizontal',
    backgroundColor: '#F5F5F5',
    iconColor: '#616161',
    amountPrefix: '',
    amountColor: '#616161',
    label: 'Self',
  },
  interest: {
    icon: 'plus-circle-outline',
    backgroundColor: '#E8F5E9',
    iconColor: '#2E7D32',
    amountPrefix: '+',
    amountColor: '#2E7D32',
    label: 'Interest',
  },
  pending: {
    icon: 'clock-outline',
    backgroundColor: '#FFF8E1',
    iconColor: '#F57C00',
    amountPrefix: '',
    amountColor: '#F57C00',
    label: 'Pending',
  },
  unknown: {
    icon: 'help-circle-outline',
    backgroundColor: '#F5F5F5',
    iconColor: '#9E9E9E',
    amountPrefix: '',
    amountColor: '#9E9E9E',
    label: 'Unknown',
  },
};

/**
 * Truncates an address for display (e.g., "RAutM...MF5")
 * @param {string} address Full address
 * @param {number} startChars Number of characters to show at start
 * @param {number} endChars Number of characters to show at end
 * @returns {string} Truncated address
 */
const truncateAddress = (address, startChars = 5, endChars = 3) => {
  if (!address || address.length <= startChars + endChars + 3) {
    return address || '';
  }
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};

/**
 * TransactionRow - Modern transaction list item component
 * 
 * @param {Object} props
 * @param {string} props.type - Transaction type: 'sent', 'received', 'self', 'interest', 'unknown'
 * @param {BigNumber|number|string} props.amount - Transaction amount
 * @param {string} props.address - Destination/source address
 * @param {number} props.timestamp - Unix timestamp
 * @param {boolean} props.confirmed - Whether transaction is confirmed
 * @param {string} props.ticker - Currency ticker (e.g., 'VRSC')
 * @param {number} props.fiatValue - Fiat equivalent value (optional)
 * @param {string} props.displayCurrency - Fiat currency code (e.g., 'USD', 'EUR')
 * @param {boolean} props.hasMemo - Whether transaction has a memo/message
 * @param {Function} props.onPress - Callback when row is pressed
 * @param {number} props.decimals - Number of decimals for display
 */
const TransactionRow = ({
  type = 'unknown',
  amount,
  address,
  timestamp,
  confirmed = true,
  ticker = '',
  fiatValue,
  displayCurrency = 'USD',
  hasMemo = false,
  onPress,
  decimals = 8,
}) => {
  // Determine the visual configuration based on type and status
  const config = useMemo(() => {
    if (!confirmed) {
      return TX_CONFIG.pending;
    }
    return TX_CONFIG[type] || TX_CONFIG.unknown;
  }, [type, confirmed]);

  // Format the amount for display
  const formattedAmount = useMemo(() => {
    if (amount == null) return '??';
    
    const amountBN = BigNumber(amount);
    
    // Handle very small amounts
    if (amountBN.isLessThan(BigNumber(0.000001)) && !amountBN.isEqualTo(0)) {
      return amountBN.toExponential(2);
    }
    
    // Truncate to reasonable decimals for display (max 6 in list view)
    const displayDecimals = Math.min(decimals, 6);
    return scientificToDecimal(truncateDecimal(amountBN.abs(), displayDecimals));
  }, [amount, decimals]);

  // Format fiat value
  const formattedFiat = useMemo(() => {
    if (fiatValue == null) return null;
    
    const fiatBN = BigNumber(fiatValue).abs();
    const [formatted] = formatCurrency({ 
      amount: fiatBN.toFixed(2), 
      code: displayCurrency 
    });
    return formatted;
  }, [fiatValue, displayCurrency]);

  // Generate primary label text
  const primaryLabel = useMemo(() => {
    if (!confirmed) {
      // Show pending with type info
      const baseConfig = TX_CONFIG[type] || TX_CONFIG.unknown;
      if (type === 'sent' && address) {
        return `Sending to ${truncateAddress(address)}`;
      } else if (type === 'received') {
        return 'Receiving';
      }
      return 'Pending';
    }

    if (type === 'received') {
      return 'Received';
    } else if (type === 'sent') {
      if (address && address !== '??') {
        return `Sent to ${truncateAddress(address)}`;
      }
      return 'Sent';
    } else if (type === 'self') {
      return 'Self transfer';
    } else if (type === 'interest') {
      return 'Staking reward';
    }
    
    return 'Transaction';
  }, [type, address, confirmed]);

  // Format relative time
  const timeLabel = useMemo(() => {
    return unixToRelativeTime(timestamp);
  }, [timestamp]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`${primaryLabel}, ${formattedAmount} ${ticker}`}
    >
      {/* Left: Icon */}
      <View style={[styles.iconContainer, { backgroundColor: config.backgroundColor }]}>
        <MaterialCommunityIcons
          name={config.icon}
          size={18}
          color={config.iconColor}
        />
      </View>

      {/* Center: Labels */}
      <View style={styles.labelContainer}>
        <View style={styles.primaryRow}>
          <Text style={styles.primaryLabel} numberOfLines={1}>
            {primaryLabel}
          </Text>
          {hasMemo && (
            <MaterialCommunityIcons
              name="message-text-outline"
              size={14}
              color={Colors.verusDarkGray}
              style={styles.memoIcon}
            />
          )}
        </View>
        <Text style={styles.secondaryLabel} numberOfLines={1}>
          {timeLabel}
        </Text>
      </View>

      {/* Right: Amount */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amountText, { color: config.amountColor }]} numberOfLines={1}>
          {config.amountPrefix}{formattedAmount} {ticker}
        </Text>
        {formattedFiat && (
          <Text style={styles.fiatText} numberOfLines={1}>
            {formattedFiat}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={Colors.verusDarkGray}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.secondaryColor,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  labelContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 12,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.quaternaryColor,
    flexShrink: 1,
  },
  memoIcon: {
    marginLeft: 6,
  },
  secondaryLabel: {
    fontSize: 13,
    color: Colors.verusDarkGray,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: 4,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fiatText: {
    fontSize: 12,
    color: Colors.verusDarkGray,
    marginTop: 2,
  },
  chevron: {
    marginLeft: 4,
  },
});

export default TransactionRow;

