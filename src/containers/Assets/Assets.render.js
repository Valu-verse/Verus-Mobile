/*
  Updated: Assets.render
  - Compact asset rows with balanced spacing and chip-style Manage Assets CTAs
  - Match icon styling to Add assets selection (square cards) with refined sizing
  - Align coin name with fiat balance, widen spacing before crypto amount, and show 4 decimal places
  - Round fiat balances to two decimals before formatting to match coin overview screens
*/
import React from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity } from 'react-native';
import { List, Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import BigNumber from 'bignumber.js';

const Row = ({ item, displayCurrency, showBalance, onPress }) => {
  const { coinObj, fiat, crypto } = item;
  const fiatRounded = BigNumber(fiat).decimalPlaces(2, BigNumber.ROUND_HALF_UP);
  const [fiatFormatted] = formatCurrency({ amount: fiatRounded.toFixed(2), code: displayCurrency });
  const cryptoAmount = BigNumber(crypto || 0);
  const cryptoFormatted = cryptoAmount.isFinite()
    ? cryptoAmount.decimalPlaces(4, BigNumber.ROUND_DOWN).toFixed(4)
    : '0.0000';

  return (
    <List.Item
      onPress={onPress}
      rippleColor="transparent"
      title={() => (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{coinObj.display_name}</Text>
          <Text style={styles.fiatValue}>
            {showBalance ? fiatFormatted : '*****'}
          </Text>
        </View>
      )}
      description={() => (
        <Text style={styles.cryptoValue}>
          {showBalance ? `${cryptoFormatted} ${coinObj.display_ticker}` : '***'}
        </Text>
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
  listHeaderComponent,
  listFooterComponent,
  refreshing = false,
  onRefresh = () => {},
  showManageAssets = true,
  emptyComponent,
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
          />
        )}
        ListHeaderComponent={headerContent}
        ListFooterComponent={listFooterComponent}
        ListEmptyComponent={emptyComponent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
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
    marginLeft: 12,
  },
  cryptoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    marginTop: 6,
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
