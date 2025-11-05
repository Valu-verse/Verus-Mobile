/*
  Updated: Assets.render
  - Render assets in compact list rows without dividers (balanced spacing)
  - Match icon styling to Add assets selection (40px square cards)
  - Balance row spacing and reduce gaps between text stacks
  - Restyle manage assets CTA to chip format with inline prompt and header variant
  - Round fiat balances to two decimals before formatting to match coin overview screens
*/
import React from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity } from 'react-native';
import { List, Text } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import { normalizeNum } from '../../utils/normalizeNum';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import BigNumber from 'bignumber.js';

const Row = ({ item, displayCurrency, showBalance, onPress }) => {
  const { coinObj, fiat, crypto } = item;
  const fiatRounded = BigNumber(fiat).decimalPlaces(2, BigNumber.ROUND_HALF_UP);
  const [fiatFormatted] = formatCurrency({ amount: fiatRounded.toFixed(2), code: displayCurrency });

  return (
    <List.Item
      onPress={onPress}
      rippleColor="transparent"
      title={coinObj.display_name}
      description={coinObj.display_ticker}
      left={() => (
        <View style={styles.leftContainer}>{RenderSquareCoinLogo(coinObj.id, {}, 40, 40)}</View>
      )}
      right={(props) => (
        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: 'black' }}>
            {showBalance ? fiatFormatted : '*****'}
          </Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 1 }}>
            {showBalance ? `${normalizeNum(Number(crypto), 8)[3]} ${coinObj.display_ticker}` : '***'}
          </Text>
        </View>
      )}
      titleStyle={{ fontSize: 16, fontWeight: '600' }}
      descriptionStyle={{ fontSize: 12, color: '#666', marginTop: 1 }}
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

const ListView = ({ assets, displayCurrency, showBalance, onPressAsset, onPressAddAssets }) => {
  return (
    <View style={styles.listContainer}>
      <AddAssetsInline onPress={onPressAddAssets} />

      {/* Buttons removed: use shared HomeFAB overlay for identical placement */}
      <FlatList
        data={assets}
        keyExtractor={(x) => x.coinObj.id}
        renderItem={({ item }) => (
          <Row
            item={item}
            displayCurrency={displayCurrency}
            showBalance={showBalance}
            onPress={() => onPressAsset(item.coinObj)}
          />
        )}
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listItemContent: {
    paddingVertical: 2,
  },
  leftContainer: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 52,
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


