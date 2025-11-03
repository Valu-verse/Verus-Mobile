/*
  Updated: Assets.render
  - Render assets in list-style rows with subtle dividers
  - Keep icon badges with theme-color backgrounds while preserving tap targets
  - Tighten horizontal spacing between icons and labels
  - Remove button-card styling ahead of upcoming non-interactive design
*/
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { List, Text, Button } from 'react-native-paper';
import { formatCurrency } from 'react-native-format-currency';
import { getCoinLogo } from '../../utils/CoinData/CoinData';
import { normalizeNum } from '../../utils/normalizeNum';
import Colors from '../../globals/colors';

const Row = ({ item, displayCurrency, showBalance, onPress }) => {
  const { coinObj, fiat, crypto } = item;
  const Logo = getCoinLogo(coinObj.id, coinObj.proto); // light variant (white) by default
  const [fiatFormatted] = formatCurrency({ amount: fiat, code: displayCurrency });
  const themeColor = coinObj.theme_color ? coinObj.theme_color : '#1C1C1C';

  return (
    <List.Item
      onPress={onPress}
      rippleColor="transparent"
      title={coinObj.display_name}
      description={coinObj.display_ticker}
      left={(props) => (
        <View style={[props.style, styles.leftContainer]}>
          <View style={[styles.iconCircle, { backgroundColor: themeColor }]}>
            {Logo ? (
              <Logo width={16} height={16} />
            ) : (
              <List.Icon {...props} color={'white'} icon="wallet" />
            )}
          </View>
        </View>
      )}
      right={(props) => (
        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: 'black' }}>
            {showBalance ? fiatFormatted : '*****'}
          </Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {showBalance ? `${normalizeNum(Number(crypto), 8)[3]} ${coinObj.display_ticker}` : '***'}
          </Text>
        </View>
      )}
      titleStyle={{ fontSize: 16, fontWeight: '600' }}
      descriptionStyle={{ fontSize: 12, color: '#666', marginTop: 2 }}
      style={styles.listItem}
      contentStyle={styles.listItemContent}
    />
  );
};

const AddAssetsInline = ({ onPress }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
    <Button 
      onPress={onPress}
      textColor={Colors.primaryColor}
      compact
      uppercase={false}
      labelStyle={{ letterSpacing: -0.2, textTransform: 'none' }}
    >
      Add assets
    </Button>
  </View>
);

const ListView = ({ assets, displayCurrency, showBalance, onPressAsset, onPressAddAssets }) => {
  return (
    <View style={styles.listContainer}>
      <AddAssetsInline onPress={onPressAddAssets} />

      {/* Buttons removed: use shared HomeFAB overlay for identical placement */}
      <FlatList
        data={assets}
        keyExtractor={(x) => x.coinObj.id}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
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

const HeaderButton = ({ onPress }) => (
  <Button 
    onPress={onPress} 
    textColor={Colors.primaryColor} 
    compact 
    uppercase={false}
    labelStyle={{ letterSpacing: -0.2 }}
  >
    Add Assets
  </Button>
);

const AssetsRender = {
  List: ListView,
  HeaderButton,
};

export default AssetsRender;

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  listContent: {
    paddingBottom: 16,
  },
  listItem: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
  },
  listItemContent: {
    paddingVertical: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E2E2',
    marginLeft: 60,
  },
  leftContainer: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


