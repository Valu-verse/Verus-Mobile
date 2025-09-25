// CurrencyWidget - Currency card component for the home screen
// Updated to improve space usage and readability:
// - Removed maxWidth constraint on coin name for better text display
// - Added middle ellipsis for long tickers (e.g., vUSDC.vETH)
// - Repositioned subwallet badge to absolute top-right position
// - Hide subwallet badge when count is 1, make it tappable
// - Removed link icon for cleaner design

import BigNumber from 'bignumber.js';
import React, {useState, useEffect} from 'react';
import {View, Dimensions, Text, TouchableOpacity} from 'react-native';
import {Avatar, Card, Paragraph, Portal} from 'react-native-paper';
import {useSelector} from 'react-redux';
import {getCoinLogo} from '../../../utils/CoinData/CoinData';
import {USD} from '../../../utils/constants/currencies';
import {GENERAL} from '../../../utils/constants/intervalConstants';
import {formatCurrency} from 'react-native-format-currency';
import SubWalletsLogo from '../../../images/customIcons/SubWallets.svg';
import {extractDisplaySubWallets} from '../../../utils/subwallet/extractSubWallets';
import {normalizeNum} from '../../../utils/normalizeNum';
import Colors from '../../../globals/colors';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import { coinsList } from '../../../utils/CoinData/CoinsList';
import SubWalletSelectorModal from '../../SubWalletSelect/SubWalletSelectorModal';
import UsdcIcon from '../../../images/customIcons/usdc-icon.webp';

const CurrencyWidget = props => {
  const {currencyBalance, coinObj} = props;
  const {width} = Dimensions.get('window');

  const Logo = getCoinLogo(coinObj.id, coinObj.proto);
  const ICON_SIZE = 20;

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

  const allSubwallets = useObjectSelector(state => extractDisplaySubWallets(state));
  const subwalletCount = allSubwallets[coinObj.id] ? allSubwallets[coinObj.id].length : 1;
  const shouldShowSubwalletBadge = subwalletCount > 1;

  const [subWalletSelectorOpen, setSubWalletSelectorOpen] = useState(false);

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

  const handleSubwalletBadgePress = () => {
    if (allSubwallets[coinObj.id]) {
      setSubWalletSelectorOpen(true);
    }
  };

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
        {/* Subwallet badge - absolute positioned */}
        {shouldShowSubwalletBadge && (
          <TouchableOpacity
            onPress={handleSubwalletBadgePress}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: override?.badgeBg || 'rgba(0, 0, 0, 0.2)',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 10,
              zIndex: 1,
            }}
            accessibilityLabel={`${subwalletCount} subwallets`}
            accessibilityRole="button">
            <Text style={{fontSize: 10, color: 'white', marginRight: 2}}>
              {subwalletCount > 99 ? '99+' : subwalletCount}
            </Text>
            <SubWalletsLogo width={12} height={12} />
          </TouchableOpacity>
        )}

        {/* Main content area */}
        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingRight: shouldShowSubwalletBadge ? 40 : 0,
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
              marginLeft: 8,
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
          <View style={{ marginTop: 12, paddingRight: shouldShowSubwalletBadge ? 40 : 12, alignItems: 'flex-end' }}>
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
          <View style={{ marginTop: 12, paddingRight: shouldShowSubwalletBadge ? 40 : 6, alignItems: 'flex-end' }}>
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
      
      {/* SubWallet Selector Modal */}
      <Portal>
        {subWalletSelectorOpen && (
          <SubWalletSelectorModal
            visible={subWalletSelectorOpen}
            chainTicker={coinObj.id}
            cancel={() => setSubWalletSelectorOpen(false)}
            animationType="slide"
            subWallets={allSubwallets[coinObj.id] || []}
            onSelect={(wallet) => {
              setSubWalletSelectorOpen(false);
              // Handle wallet selection if needed - for now just close
            }}
            displayTicker={coinObj.display_ticker}
          />
        )}
      </Portal>
    </Card>
  );
};

export default CurrencyWidget;
