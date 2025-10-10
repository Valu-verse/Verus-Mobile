/*
  New file: Assets.render
  - Presentational components for the Assets screen
  - List row with left logo+name and right fiat value + amount
*/
import React from 'react';
import { FlatList, View } from 'react-native';
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
      title={coinObj.display_name}
      description={coinObj.display_ticker}
      left={(props) => (
        <View style={[props.style, { width: 40, alignItems: 'center', justifyContent: 'center' }]}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: themeColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
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
      style={{ backgroundColor: 'transparent' }}
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
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <AddAssetsInline onPress={onPressAddAssets} />

      {/* Buttons removed: use shared HomeFAB overlay for identical placement */}
      <FlatList
        data={assets}
        keyExtractor={(x) => x.coinObj.id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={{ 
            marginHorizontal: 12,
            borderRadius: 8,
            backgroundColor: 'white',
          }}>
            <Row
              item={item}
              displayCurrency={displayCurrency}
              showBalance={showBalance}
              onPress={() => onPressAsset(item.coinObj)}
            />
          </View>
        )}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
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


