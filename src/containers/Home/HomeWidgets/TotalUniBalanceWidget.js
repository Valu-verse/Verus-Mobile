// TotalUniBalanceWidget
// Changes:
// - Modernized visual hierarchy
// - Label ('Total value') positioned snug at top-left
// - Amount left-aligned and vertically centered
// - Amount font size increased for emphasis
import React, {useState, useEffect} from 'react';
import {View, Dimensions, TouchableOpacity, Text} from 'react-native';
import {Card, Paragraph} from 'react-native-paper';
import {useDispatch, useSelector} from 'react-redux';
import {USD} from '../../../utils/constants/currencies';
import {formatCurrency} from 'react-native-format-currency';
import Colors from '../../../globals/colors';

const TotalUniBalanceWidget = props => {
  const {totalBalance} = props;
  const {width} = Dimensions.get('window');
  const dispatch = useDispatch();
  const showBalance = useSelector(state => state.coins.showBalance);

  const displayCurrency = useSelector(state =>
    state.settings.generalWalletSettings.displayCurrency
      ? state.settings.generalWalletSettings.displayCurrency
      : USD,
  );

  const [uniValueDisplay, setUniValueDisplay] = useState('-');

  useEffect(() => {
    if (totalBalance != null && displayCurrency != null) {
      const [valueFormattedWithSymbol, valueFormattedWithoutSymbol, symbol] =
        formatCurrency({
          amount: Number(totalBalance.toFixed(2)),
          code: displayCurrency,
        });

      setUniValueDisplay(valueFormattedWithSymbol);
    }
  }, [totalBalance, displayCurrency]);

  return (
    <Card
      style={{
        height: 110,
        width: width / 2 - 16,
        borderRadius: 10,
        backgroundColor: Colors.ultraUltraLightGrey,
        position: 'relative',
      }}
      mode="outlined">
      <Card.Content>
        {/* Top-left label */}
        <Paragraph
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            fontSize: 12,
            color: Colors.quaternaryColor,
            zIndex: 1,
          }}
        >
          {'Total value'}
        </Paragraph>

        {/* Vertically centered amount */}
        <View style={{ height: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 4, paddingLeft: 12, paddingRight: 12, zIndex: 2 }}>
          {showBalance ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.6}
              style={{
                fontSize: 32,
                fontWeight: '700',
                letterSpacing: -1,
                includeFontPadding: false,
                textAlign: 'center'
              }}
            >
              {uniValueDisplay}
            </Text>
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.6}
              style={{
                fontSize: 32,
                fontWeight: '700',
                letterSpacing: -0.2,
                includeFontPadding: false,
                textAlign: 'center'
              }}
            >
              ********
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );
};

export default TotalUniBalanceWidget;
