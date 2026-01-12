// CurrencyWidget - Currency card component for the home screen
// Updated to improve space usage and readability:
// - Removed maxWidth constraint on coin name for better text display
// - Added middle ellipsis for long tickers (e.g., vUSDC.vETH)
// - Removed subwallet count badge and selector (users choose subwallet after opening currency)
// - Removed link icon for cleaner design

import BigNumber from 'bignumber.js';
import React, {useState, useEffect} from 'react';
import {View, Dimensions} from 'react-native';
import {Avatar, Card, Paragraph} from 'react-native-paper';
import {useSelector} from 'react-redux';
import {getCoinLogo} from '../../../utils/CoinData/CoinData';
import {USD} from '../../../utils/constants/currencies';
import {GENERAL} from '../../../utils/constants/intervalConstants';
import {formatCurrency} from 'react-native-format-currency';
// Subwallet badge and selector removed
import {normalizeNum} from '../../../utils/normalizeNum';
import Colors from '../../../globals/colors';
// import { useObjectSelector } from '../../../hooks/useObjectSelector';
// import { coinsList } from '../../../utils/CoinData/CoinsList';
import UsdcIcon from '../../../images/customIcons/usdc-icon.webp';

const CurrencyWidget = props => {
  const {currencyBalance, coinObj} = props;
  const {width} = Dimensions.get('window');

  const Logo = getCoinLogo(coinObj.id, coinObj.proto, 'dark');
  const ICON_SIZE = 40;

  // Style-only overrides per currency (no coinsList change)
  const WIDGET_OVERRIDES = {
    'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd': {
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      badgeBg: '#0A6AE3',
      name: 'vUSDC',
      renderLogo: () => (
        <Avatar.Image
          size={ICON_SIZE}
          source={UsdcIcon}
          style={{ backgroundColor: 'transparent' }}
        />
      ),
    },
  };

  const override = WIDGET_OVERRIDES[coinObj.id];
  const themeColor = override?.backgroundColor || (coinObj.theme_color ? coinObj.theme_color : '#1C1C1C');
  const showBalance = useSelector(state => state.coins.showBalance);

  // Subwallet badge removed; selection happens after opening currency

  const displayCurrency = useSelector(state =>
    state.settings.generalWalletSettings.displayCurrency
      ? state.settings.generalWalletSettings.displayCurrency
      : USD,
  );
  const uniRate = useSelector(state =>
    state.ledger.rates[GENERAL] && state.ledger.rates[GENERAL][coinObj.id]
      ? state.ledger.rates[GENERAL][coinObj.id][displayCurrency]
      : null,
  );

  const [uniValueDisplay, setUniValueDisplay] = useState('-');

  // Recalculate fiat value
  useEffect(() => {
    if (uniRate != null && currencyBalance != null && displayCurrency != null) {
      const price = BigNumber(uniRate);

      const displayValueRaw = normalizeNum(
        Number(BigNumber(currencyBalance).multipliedBy(price)),
        2,
      )[3];

      const [valueFormattedWithSymbol, valueFormattedWithoutSymbol, symbol] =
        formatCurrency({amount: displayValueRaw, code: displayCurrency});

      setUniValueDisplay(valueFormattedWithSymbol);
    }
  }, [currencyBalance, uniRate, displayCurrency]);

  let displayedName =
    coinObj.display_name.length > 8
      ? coinObj.display_ticker
      : coinObj.display_name;
  if (override?.name) displayedName = override.name;

  // Subwallet badge removed

  // Precompute secondary text to avoid deeply nested ternaries in JSX
  const secondaryTextHidden = (
    coinObj.testnet && coinObj.proto === 'erc20'
      ? 'Testnet ERC20 Token'
      : !!coinObj.testnet
      ? 'Testnet Currency'
      : coinObj.pbaas_options && !coinObj.compatible_channels.includes(GENERAL)
      ? 'PBaaS Currency'
      : uniValueDisplay === '-'
      ? (coinObj.proto === 'erc20'
          ? (coinObj.unlisted ? 'Unlisted Token' : 'ERC20 Token')
          : uniValueDisplay)
      : `*** ${coinObj.display_ticker}`
  );

  const secondaryTextVisible = (
    coinObj.testnet && coinObj.proto === 'erc20'
      ? 'Testnet ERC20 Token'
      : !!coinObj.testnet
      ? 'Testnet Currency'
      : coinObj.pbaas_options && !coinObj.compatible_channels.includes(GENERAL)
      ? 'PBaaS Currency'
      : uniValueDisplay === '-'
      ? (coinObj.proto === 'erc20'
          ? (coinObj.unlisted ? 'Unlisted Token' : 'ERC20 Token')
          : uniValueDisplay)
      : `${currencyBalance == null ? '-' : normalizeNum(Number(currencyBalance), 4)[3]} ${coinObj.display_ticker}`
  );

  return (
    <Card
      style={{
        height: 110,
        width: width / 2 - 16,
        borderRadius: 10,
        backgroundColor: themeColor,
        position: 'relative',
      }}
      mode="elevated"
      elevation={5}>
      <Card.Content>
        {/* Subwallet badge removed */}

        {/* Main content area */}
        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingRight: 0,
            height: 40,
          }}>
          {override?.renderLogo ? (
            // Custom icon defined in override (keep its own sizing)
            override.renderLogo()
          ) : Logo == null ? (
            <Avatar.Icon
              icon="wallet"
              color={themeColor}
              style={{backgroundColor: 'white'}}
              size={ICON_SIZE}
            />
          ) : (
            <Logo
              style={{
                alignSelf: 'center',
              }}
              width={ICON_SIZE}
              height={ICON_SIZE}
            />
          )}
          <Paragraph
            style={{
              fontSize: 16,
              marginLeft: 12,
              fontWeight: 'bold',
              flex: 1,
              color: override?.textColor || Colors.secondaryColor,
            }}
            numberOfLines={1}
            ellipsizeMode="middle">
            {displayedName}
          </Paragraph>
        </View>

        {!showBalance ? (
          <View style={{ marginTop: 12, paddingRight: 6, alignItems: 'flex-end' }}>
            <Paragraph
             numberOfLines={1}
             style={{fontSize: 20, fontWeight: '700', color: override?.textColor || Colors.secondaryColor, letterSpacing: -0.05, textAlign: 'right'}}
            >
              {!!coinObj.testnet || uniValueDisplay === '-'
                ? `${
                    currencyBalance == null
                      ? '-'
                      : '***'
                  } ${coinObj.display_ticker}`
                : '*****'}
            </Paragraph>
            <Paragraph
              numberOfLines={1}
              style={{fontSize: 12, fontWeight: '400', color: override?.textColor ? '#666' : 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 16, textAlign: 'right'}}
            >
              {secondaryTextHidden}
            </Paragraph>
          </View>
        ) : (
          <View style={{ marginTop: 12, paddingRight: 6, alignItems: 'flex-end' }}>
            <Paragraph
              numberOfLines={1}
              style={{fontSize: 20, fontWeight: '700', color: override?.textColor || Colors.secondaryColor, letterSpacing: -0.05, textAlign: 'right'}}>
              {coinObj.testnet || uniValueDisplay === '-'
                ? `${
                    currencyBalance == null
                      ? '-'
                      : normalizeNum(Number(currencyBalance), 4)[3]
                  } ${coinObj.display_ticker}`
                : uniValueDisplay}
            </Paragraph>
            <Paragraph style={{fontSize: 12, fontWeight: '400', color: override?.textColor ? '#666' : 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 16, textAlign: 'right'}}>
              {secondaryTextVisible}
            </Paragraph>
          </View>
        )}
      </Card.Content>
      
      {/* SubWallet Selector Modal removed */}
    </Card>
  );
};

export default CurrencyWidget;
