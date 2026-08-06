/*
  Updated: Assets.render
  - Align per-asset price with the balance row on the right
  - Hide per-asset price when total fiat is unavailable (N/A) and balance is visible
  - 2026-02-09: Show per-coin fiat rate (unit price) even when amounts are hidden; it does
    not reveal balance and lets users see coin price in privacy mode.
  - Remove ticker suffix from per-asset price
  - Preserve existing balance masking and formatting behavior
  - Updated 2025-11-29: Ensure coin ticker remains visible when balance is hidden
  - 2026-01-09: Allow passing onScroll through to FlatList (used for Wallet sticky-header divider).
  - 2026-01-23: Display "Price unavailable" for assets without fiat pricing data instead
    of showing €0,00.
*/
import React from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity } from 'react-native';
import { List, Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import BigNumber from 'bignumber.js';
import Colors from '../../globals/colors';

const Row = ({ item, displayCurrency, showBalance, onPress, onBridgePress, onCashoutPress, onOfframpPress }) => {
  const { coinObj, fiat, crypto, rate } = item;
  const cryptoAmount = BigNumber(crypto || 0);
  const hasBalance = cryptoAmount.isGreaterThan(0);
  
  // Only show "N/A" if there's a balance but no fiat price
  const fiatFormatted = fiat != null
    ? (() => {
        const fiatRounded = BigNumber(fiat).decimalPlaces(2, BigNumber.ROUND_HALF_UP);
        const [formatted] = formatCurrency({ amount: fiatRounded.toFixed(2), code: displayCurrency });
        return formatted;
      })()
    : hasBalance
    ? null // Will render N/A separately
    : (() => {
        // Zero balance - show formatted zero
        const [formatted] = formatCurrency({ amount: '0.00', code: displayCurrency });
        return formatted;
      })();
  
  const cryptoFormatted = cryptoAmount.isFinite()
    ? cryptoAmount.decimalPlaces(4, BigNumber.ROUND_DOWN).toFixed(4)
    : '0.0000';

  const rateFormatted = rate != null
    ? (() => {
        const rateRounded = BigNumber(rate).decimalPlaces(2, BigNumber.ROUND_HALF_UP);
        const [formatted] = formatCurrency({ amount: rateRounded.toFixed(2), code: displayCurrency });
        return formatted;
      })()
    : null;

  // Per-coin rate is safe to show when amounts hidden (no balance revealed)
  const showRate = rateFormatted != null && (!showBalance || fiatFormatted != null);

  return (
    <List.Item
      onPress={onPress}
      rippleColor="transparent"
      title={() => (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{coinObj.display_name}</Text>
          {showBalance ? (
            fiatFormatted != null ? (
              <Text style={styles.fiatValue}>{fiatFormatted}</Text>
            ) : (
              <Text style={styles.fiatNA}>N/A</Text>
            )
          ) : (
            <Text style={styles.fiatValue}>*****</Text>
          )}
        </View>
      )}
      description={() => (
        <View style={styles.descriptionRow}>
          <Text style={styles.cryptoValue}>
            {showBalance ? `${cryptoFormatted} ${coinObj.display_ticker}` : `*** ${coinObj.display_ticker}`}
          </Text>
          <View style={styles.descriptionRight}>
            {showRate ? <Text style={styles.fiatRate}>{rateFormatted}</Text> : null}
            {onBridgePress && hasBalance && showBalance ? (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); onBridgePress(); }}
                style={styles.bridgeChip}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.bridgeChipText}>Send to Verus</Text>
              </TouchableOpacity>
            ) : null}
            {onCashoutPress && hasBalance && showBalance ? (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); onCashoutPress(); }}
                style={styles.cashoutChip}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.cashoutChipText}>Cash Out</Text>
              </TouchableOpacity>
            ) : null}
            {onOfframpPress && hasBalance && showBalance ? (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); onOfframpPress(); }}
                style={styles.offrampChip}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.offrampChipText}>Send to Polygon</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
      left={() => (
        <View style={styles.leftContainer}>{RenderSquareCoinLogo(coinObj.id, {}, 38, 38)}</View>
      )}
      style={styles.listItem}
      contentStyle={styles.listItemContent}
    />
  );
};

const ManageAssetsAction = ({ onPress, style }) => (
  <View style={[styles.manageAssetsContainer, style]}>
    <Text style={styles.manageAssetsPrompt}>{'Add or remove assets'}</Text>
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.manageAssetsChip}>
      <Text style={styles.manageAssetsChipLabel}>{'Manage assets'}</Text>
    </TouchableOpacity>
  </View>
);

const AddAssetsInline = ({ onPress }) => <ManageAssetsAction onPress={onPress} style={styles.manageAssetsInline} />;

const ListView = ({
  assets,
  displayCurrency,
  showBalance,
  onPressAsset,
  onPressAddAssets,
  onBridgePress,
  bridgeableCoinIds,
  cashoutCoinIds,
  onCashoutPress,
  offrampableVerusCoinIds,
  onOfframpPress,
  listHeaderComponent,
  listFooterComponent,
  refreshing = false,
  onRefresh = () => {},
  showManageAssets = true,
  emptyComponent,
  onScroll,
  scrollEventThrottle = 16,
}) => {
  const headerContent = () => (
    <View>
      {listHeaderComponent}
      {showManageAssets && onPressAddAssets ? (
        <AddAssetsInline onPress={onPressAddAssets} />
      ) : null}
    </View>
  );

  return (
    <View style={styles.listContainer}>
      <FlatList
        data={assets}
        keyExtractor={(x) => x.coinObj.id}
        renderItem={({ item }) => (
          <Row
            item={item}
            displayCurrency={displayCurrency}
            showBalance={showBalance}
            onPress={
              onPressAsset
                ? () => onPressAsset(item.coinObj)
                : undefined
            }
            onBridgePress={
              bridgeableCoinIds && onBridgePress && bridgeableCoinIds.has(item.coinObj.id)
                ? () => onBridgePress(item.coinObj, item.crypto)
                : undefined
            }
            onCashoutPress={
              cashoutCoinIds && onCashoutPress && cashoutCoinIds.has(item.coinObj.id)
                ? () => onCashoutPress(item.coinObj, item.crypto)
                : undefined
            }
            onOfframpPress={
              offrampableVerusCoinIds && onOfframpPress && offrampableVerusCoinIds.has(item.coinObj.id)
                ? () => onOfframpPress(item.coinObj, item.crypto)
                : undefined
            }
          />
        )}
        ListHeaderComponent={headerContent}
        ListFooterComponent={listFooterComponent}
        ListEmptyComponent={emptyComponent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      />
    </View>
  );
};

const HeaderButton = ({ onPress }) => <ManageAssetsAction onPress={onPress} style={styles.manageAssetsHeader} />;

const AssetsRender = {
  List: ListView,
  HeaderButton,
};

export default AssetsRender;

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContent: {
    paddingBottom: 16,
  },
  listItem: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  listItemContent: {
    paddingVertical: 0,
  },
  leftContainer: {
    paddingRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fiatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'right',
  },
  fiatNA: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999999',
    textAlign: 'right',
  },
  fiatRate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
    textAlign: 'right',
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  descriptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cryptoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  bridgeChip: {
    backgroundColor: Colors.primaryColor + '18',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bridgeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryColor,
  },
  cashoutChip: {
    backgroundColor: '#15803D18',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cashoutChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  offrampChip: {
    backgroundColor: '#B4530918',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offrampChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  manageAssetsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingVertical: 6,
  },
  manageAssetsInline: {
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 22,
    paddingBottom: 12,
    marginBottom: 8,
  },
  manageAssetsHeader: {
    marginRight: 8,
  },
  manageAssetsPrompt: {
    fontSize: 12,
    color: '#666666',
    marginRight: 8,
  },
  manageAssetsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  manageAssetsChipLabel: {
    fontSize: 12,
    color: '#333333',
    fontWeight: '500',
  },
});
