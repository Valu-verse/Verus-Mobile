// TotalUniBalanceWidget
// 2025-11-04: Converted to a full-width hero row with inline currency symbol and no card chrome.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { USD } from '../../../utils/constants/currencies';
import { formatCurrency } from 'react-native-format-currency';
import Colors from '../../../globals/colors';

const TOTAL_PLACEHOLDER = '—';

const TotalUniBalanceWidget = ({ totalBalance }) => {
  const showBalance = useSelector((state) => state.coins.showBalance);
  const displayCurrency = useSelector((state) =>
    state.settings.generalWalletSettings.displayCurrency
      ? state.settings.generalWalletSettings.displayCurrency
      : USD,
  );

  const [valueDisplay, setValueDisplay] = useState({ symbol: '', value: TOTAL_PLACEHOLDER });

  useEffect(() => {
    if (totalBalance != null && displayCurrency != null) {
      const amount = Number(totalBalance.toFixed(2));
      
      // Show '0.00' when balance is zero
      if (amount === 0) {
        const [, , symbol] = formatCurrency({
          amount: 0,
          code: displayCurrency,
        });
        setValueDisplay({
          symbol: symbol || displayCurrency,
          value: '0.00',
        });
      } else {
        const [, valueWithoutSymbol, symbol] = formatCurrency({
          amount,
          code: displayCurrency,
        });

        setValueDisplay({
          symbol: symbol || displayCurrency,
          value: valueWithoutSymbol.trim(),
        });
      }
    } else {
      setValueDisplay({ symbol: '', value: TOTAL_PLACEHOLDER });
    }
  }, [totalBalance, displayCurrency]);

  const hasResolvedValue = valueDisplay.value !== TOTAL_PLACEHOLDER;
  const maskDisplay = '********';

  return (
    <View style={styles.container}>
      {showBalance ? (
        <View style={styles.valueRow}>
          {hasResolvedValue && valueDisplay.symbol ? (
            <Text style={styles.symbol}>{valueDisplay.symbol}</Text>
          ) : null}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.35}
            style={styles.amount}
          >
            {hasResolvedValue ? valueDisplay.value : TOTAL_PLACEHOLDER}
          </Text>
        </View>
      ) : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.35}
          style={styles.mask}
        >
          {maskDisplay}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 28,
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  symbol: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.quinaryColor,
    includeFontPadding: false,
    lineHeight: 36,
    marginRight: 4,
    marginTop: 4,
  },
  amount: {
    flexShrink: 1,
    fontSize: 64,
    fontWeight: '700',
    color: Colors.quinaryColor,
    letterSpacing: -2,
    includeFontPadding: false,
    lineHeight: 66,
  },
  mask: {
    fontSize: 64,
    fontWeight: '700',
    color: Colors.quinaryColor,
    letterSpacing: 3,
    includeFontPadding: false,
    lineHeight: 66,
  },
});

export default TotalUniBalanceWidget;
