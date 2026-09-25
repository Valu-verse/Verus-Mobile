/*
  DynamicHeader
  - Renders the swipeable address card carousel on the coin overview screen.
  - Swiping updates the active sub-wallet (which drives balances + transactions).
  - Updated 2026-01-10 (A1 redesign):
    * Bold gradient address cards that own the big balance + fiat display
    * Compact "Addresses 1/4" selector header (no dots / swipe hints)
    * Network ticker watermark, address copy row, and minimal status (pending/sync)
    * Card order sorted by confirmed balance (high → low)
*/

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Clipboard, FlatList, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { setCoinSubWallet } from '../../actions/actionCreators';
import {
  API_GET_BALANCES,
  API_GET_FIATPRICE,
  API_GET_INFO,
  DLIGHT_PRIVATE,
  ERC20,
} from '../../utils/constants/intervalConstants';
import Colors from '../../globals/colors';
import BigNumber from 'bignumber.js';
import {
  extractErrorData,
  extractLedgerData,
} from '../../utils/ledger/extractLedgerData';
import { CONNECTION_ERROR } from '../../utils/api/errors/errorMessages';
import { truncateDecimal } from '../../utils/math';
import { USD } from '../../utils/constants/currencies';
import { formatCurrency } from 'react-native-format-currency';
import { useSelector, useDispatch } from 'react-redux';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import { coinsList } from '../../utils/CoinData/CoinsList';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SPACING = 12;
const CONTAINER_PADDING = 20;
const CARD_WIDTH = SCREEN_WIDTH - (CONTAINER_PADDING * 2) - 32;
const CARD_HEIGHT = 206;

const CARD_ACCENT = '#00C8FF';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const normalizeHex = (hex) => {
  if (hex == null || typeof hex !== 'string') return null;
  const clean = hex.trim();
  if (!clean.startsWith('#')) return null;
  if (clean.length === 4) {
    // #RGB -> #RRGGBB
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (clean.length === 7) return clean.toUpperCase();
  return null;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
};

const rgbToHex = ({ r, g, b }) => {
  const to = (x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
};

const mixHex = (a, b, weight = 0.5) => {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return a;
  const w = clamp(weight, 0, 1);
  return rgbToHex({
    r: rgbA.r * (1 - w) + rgbB.r * w,
    g: rgbA.g * (1 - w) + rgbB.g * w,
    b: rgbA.b * (1 - w) + rgbB.b * w,
  });
};

const isLightColor = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  // relative luminance approximation
  const luma = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luma > 0.72;
};

const truncateMiddle = (value, start = 8, end = 8) => {
  if (typeof value !== 'string') return '';
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(value.length - end)}`;
};

const getNetworkTicker = (systemId) => {
  if (!systemId) return '';
  if (systemId === '.eth') return 'ETH';

  // Prefer coinsList (fast path)
  if (coinsList[systemId]?.display_ticker) return coinsList[systemId].display_ticker;

  // Fallback to CoinDirectory for PBaaS chains
  try {
    const coinObj = CoinDirectory.findCoinObj(systemId);
    if (coinObj?.display_ticker) return coinObj.display_ticker;
  } catch (e) {
    // ignore
  }

  // Last resort: avoid showing raw i-addresses
  if (typeof systemId === 'string' && systemId.startsWith('i') && systemId.length > 30) return '';

  return systemId;
};

const DynamicHeader = () => {
  const dispatch = useDispatch();
  const flatListRef = useRef(null);
  const activeWalletIdRef = useRef(null);

  const chainTicker = useSelector((state) => state.coins.activeCoin.id);
  const showBalance = useSelector((state) => state.coins.showBalance);
  const displayTicker = useSelector((state) => state.coins.activeCoin.display_ticker);
  const displayCurrency = useSelector(
    (state) => state.settings.generalWalletSettings.displayCurrency || USD,
  );
  const activeAccount = useSelector((state) => state.authentication.activeAccount);
  const activeCoin = useSelector((state) => state.coins.activeCoin);
  
  const selectedSubWallet = useObjectSelector(
    (state) => state.coinMenus.activeSubWallets[chainTicker],
  );
  const allSubWallets = useObjectSelector(
    (state) => state.coinMenus.allSubWallets[chainTicker],
  );
  const balances = useObjectSelector((state) =>
    extractLedgerData(state, 'balances', API_GET_BALANCES, chainTicker),
  );
  const info = useObjectSelector((state) =>
    extractLedgerData(state, 'info', API_GET_INFO, chainTicker),
  );
  const balanceErrors = useObjectSelector((state) =>
    extractErrorData(state, API_GET_BALANCES, chainTicker),
  );
  const rates = useObjectSelector((state) => state.ledger.rates);

  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedWalletId, setCopiedWalletId] = useState(null);
  const copyTimeoutRef = useRef(null);

  const cardTheme = useMemo(() => {
    const base = normalizeHex(activeCoin?.theme_color) || Colors.primaryColor;
    const top = mixHex(base, CARD_ACCENT, 0.55);
    const mid = mixHex(base, CARD_ACCENT, 0.25);
    const bottom = mixHex(base, '#000000', 0.18);
    const highlight = mixHex(base, '#FFFFFF', 0.35);
    const light = isLightColor(base);
    return {
      base,
      top,
      mid,
      bottom,
      highlight,
      light,
      text: light ? Colors.quinaryColor : '#FFFFFF',
      mutedText: light ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.78)',
      pillBg: light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.18)',
      pillBorder: light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.25)',
    };
  }, [activeCoin?.theme_color]);

  const walletItems = useMemo(() => {
    if (!allSubWallets || allSubWallets.length === 0) return [];

    const withMeta = allSubWallets.map((wallet, originalIndex) => {
      const confirmed = balances?.[wallet.id]?.confirmed;
      return {
        ...wallet,
        originalIndex,
        __confirmedBalance: confirmed == null ? BigNumber(0) : BigNumber(confirmed),
      };
    });

    // Sort: highest confirmed balance first; tie-break by stable original order
    withMeta.sort((a, b) => {
      const diff = b.__confirmedBalance.comparedTo(a.__confirmedBalance);
      if (diff !== 0) return diff;
      return a.originalIndex - b.originalIndex;
    });

    return withMeta;
  }, [allSubWallets, balances]);

  useEffect(() => {
    if (selectedSubWallet && walletItems.length > 0) {
      const index = walletItems.findIndex((w) => w.id === selectedSubWallet.id);
      if (index !== -1 && index !== activeIndex) {
        setActiveIndex(index);
        activeWalletIdRef.current = selectedSubWallet.id;
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: false });
        }, 100);
      }
    }
  }, [selectedSubWallet, walletItems]);

  // Keep the current card stable when walletItems re-sorts due to balance updates
  useEffect(() => {
    setLoadingCarouselItems(true);
    const items = prepareCarouselItems(allSubWallets, selectedSubWallet);
    setCarouselItems(items);
    setLoadingCarouselItems(false);
  }, [allSubWallets, selectedSubWallet, prepareCarouselItems]);

  const setSubWallet = (wallet) => {
    dispatch(setCoinSubWallet(chainTicker, wallet));

    const items = prepareCarouselItems(allSubWallets, wallet);
    setCarouselItems(items);
  };

  const calculateSyncProgress = (subWallet) => {
    if (info == null || info[subWallet.id] == null) {
      return null;
    } else {
      return info[subWallet.id].percent;
    }
  };

  const handleItemPress = (index) => {
    if (selectedSubWallet != null && index !== 0) {
      setSubWallet(carouselItems[index]);
    }
  };

  const handleLeftSwipe = () => {
    if (selectedSubWallet != null && carouselItems.length > 1) {
      const currentIndex = carouselItems.findIndex(
        (x) => x.id === selectedSubWallet.id,
      );
      const index =
        currentIndex === carouselItems.length - 1 ? 0 : currentIndex + 1;

      setSubWallet(carouselItems[index]);
    }
  };

  const handleRightSwipe = () => {
    if (selectedSubWallet != null && carouselItems.length > 1) {
      const currentIndex = carouselItems.findIndex(
        (x) => x.id === selectedSubWallet.id,
      );
      const index =
        currentIndex === 0 ? carouselItems.length - 1 : currentIndex - 1;

      setSubWallet(carouselItems[index]);
    }
  };

  const handleCopyAddress = useCallback((walletId, value) => {
    if (!value) return;
    Clipboard.setString(value);
    setCopiedWalletId(walletId);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedWalletId(null);
      copyTimeoutRef.current = null;
    }, 2000);
  }, []);

  const openTokenAddressExplorer = (address, testnet) => {
    const baseUrl = testnet
      ? 'https://goerli.etherscan.io/token/'
      : 'https://etherscan.io/token/';

    return createAlert(
      'Go to explorer?',
      `Would you like to go to ${baseUrl} to see more information about ${address}?`,
      [
        {
          text: 'No',
          onPress: async () => {
            resolveAlert(false);
          },
        },
        {
          text: 'Yes',
          onPress: () => {
            openUrl(baseUrl + '/' + address);
            resolveAlert(false);
          },
        },
      ],
    );
  };

  const renderCarouselItem = ({ item, index, alone }) => {
    const displayBalance =
      balances[item.id] != null ? balances[item.id].confirmed : null;

    const pendingBalance =
      balances[item.id] != null ? balances[item.id].pending : null;

    let fiatBalance = null;
    const ratesForChannel =
      rates[item.api_channels[API_GET_FIATPRICE]] != null
        ? rates[item.api_channels[API_GET_FIATPRICE]][chainTicker]
        : null;

    if (
      displayBalance != null &&
      ratesForChannel != null &&
      ratesForChannel[displayCurrency] != null
    ) {
      const price = BigNumber(ratesForChannel[displayCurrency]);

      fiatBalance = BigNumber(displayBalance).multipliedBy(price).toFixed(2);
    }

    const syncProgress = calculateSyncProgress(item);
    const shouldShowSyncProgress =
      item.api_channels[API_GET_INFO] === DLIGHT_PRIVATE &&
      typeof syncProgress === 'number' &&
      syncProgress !== 100 &&
      syncProgress !== -1;
    const subtitleText = shouldShowSyncProgress
      ? `Syncing - ${syncProgress.toFixed(2)}%`
      : `${
          fiatBalance == null
            ? '-'
            : formatCurrency({
                amount: fiatBalance,
                code: displayCurrency,
              })[0]
        }`;

    return (
      <Animated.View
        style={{
          opacity: fadeAnimation,
          width:
            index == 0 ? (3 * DEVICE_WINDOW_WIDTH) / 4 : DEVICE_WINDOW_WIDTH / 4,
          overflow: 'hidden',
          marginRight: index == 0 && !alone ? 16 : 0,
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {index == 0 && !alone && (
          <Button
            icon="format-list-bulleted"
            mode="text"
            onPress={() => setSubWallet(null)}
            uppercase={false}
          >
            List all cards
          </Button>
        )}
        <Card
          style={{
            height: 156,
            borderRadius: 10,
            minWidth: (3 * DEVICE_WINDOW_WIDTH) / 4,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: item.color,
            opacity: index == 0 ? 1 : 0.3,
          }}
          onPress={() => handleItemPress(index)}
        >
          <Card.Content
            style={{
              display: 'flex',
              height: '100%',
              justifyContent: 'space-between',
            }}
          >
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center' }}
              disabled={index != 0}
              onPress={openReceiveTab}
            >
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: Colors.secondaryColor,
                  padding: 8,
                  height: 36,
                  borderRadius: 8,
                  flex: 1,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: Colors.quaternaryColor,
                  }}
                >
                  {item.name}
                </Text>
              </View>
              <IconButton
                icon="arrow-down"
                iconColor={Colors.secondaryColor}
                style={{
                  marginRight: 0,
                }}
              />
            </TouchableOpacity>
            {!showBalance ? (
              <Paragraph
                style={{
                  fontSize: 18,
                  marginBottom: 24,
                  color: Colors.secondaryColor,
                }}
                numberOfLines={2}
              >
                *********
              </Paragraph>
            ) : (
              <View>
                <View style={{ flexDirection: 'row' }}>
                  <Paragraph
                    style={{
                      fontSize: 16,
                      color: Colors.secondaryColor,
                      fontWeight: balanceErrors[item.id] ? 'normal' : 'bold',
                    }}
                    numberOfLines={1}
                  >
                    {balanceErrors[item.id]
                      ? CONNECTION_ERROR
                      : `${
                          displayBalance == null
                            ? '-'
                            : truncateDecimal(displayBalance, 8)
                        }${
                          pendingBalance != null &&
                          !BigNumber(pendingBalance).isEqualTo(0)
                            ? ` (${
                                BigNumber(pendingBalance).isGreaterThan(0)
                                  ? '+'
                                  : ''
                              }${truncateDecimal(pendingBalance, 4)})`
                            : ''
                        }`}
                  </Paragraph>
                  <Paragraph
                    style={{
                      fontSize: 16,
                      color: Colors.secondaryColor,
                      alignSelf: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {balanceErrors[item.id] ? '' : ` ${displayTicker}`}
                  </Paragraph>
                </View>
                <Paragraph
                  style={{
                    ...Styles.listItemSubtitleDefault,
                    fontSize: 12,
                    color: Colors.secondaryColor,
                    marginTop: 0,
                  }}
                >
                  {subtitleText}
                </Paragraph>
              </View>
            )}
            {item.network && (
              <View
                style={{
                  flexDirection: 'row',
                  paddingTop: 4,
                }}
              >
                <View
                  style={{
                    borderRadius: 36,
                    borderColor: Colors.secondaryColor,
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    flexDirection: 'row',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}
                  >{`${getNetworkName(item)}`}</Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: 'white',
                      fontSize: 12,
                      alignSelf: 'center',
                    }}
                  >{` Network`}</Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
      </Animated.View>
    );
  };

  const mappedToEth =
    activeCoin.mapped_to != null &&
    mappedCoinObj != null &&
    (mappedCoinObj.currency_id.toLowerCase() ===
      VERUS_BRIDGE_DELEGATOR_GOERLI_CONTRACT.toLowerCase() ||
      mappedCoinObj.currency_id.toLowerCase() ===
        VERUS_BRIDGE_DELEGATOR_MAINNET_CONTRACT.toLowerCase());

  return (
    <GestureDetector
      gesture={Gesture.Fling()
        .direction(Directions.LEFT)
        .onEnd(handleLeftSwipe)}
    >
      <GestureDetector
        gesture={Gesture.Fling()
          .direction(Directions.RIGHT)
          .onEnd(handleRightSwipe)}
      >
        <View
          style={{
            maxHeight: 296,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            backgroundColor: Colors.secondaryColor,
          }}
        >
          <View
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            {showBalance ? (
              <View style={{ flexDirection: 'row' }}>
                <Text style={{ fontSize: 18 }}>{'Total: '}</Text>
                <Text style={{ fontWeight: '500', fontSize: 18 }}>{`${truncateDecimal(
                  confirmedBalance,
                  8,
                )} ${displayTicker}`}</Text>
              </View>
            ) : (
              <Text style={{ fontWeight: '500', fontSize: 18 }}>******</Text>
            )}
            {!pendingBalance.isEqualTo(0) && (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '300',
                  color: Colors.quaternaryColor,
                  paddingTop: 4,
                }}
              >
                <Text style={{ color: Colors.quaternaryColor }}>
                  {pendingBalance.isGreaterThan(0) ? '+' : ''}
                </Text>
                <Text
                  style={{ fontWeight: '500', color: Colors.quaternaryColor }}
                >
                  {truncateDecimal(pendingBalance, 8)}
                </Text>
              )}
            </View>
            {fiatText != null && (
              <Text style={[styles.fiatText, { color: cardTheme.mutedText }]} numberOfLines={1}>
                {fiatText}
              </Text>
            )}
            {statusLine && (
              <Text style={[styles.statusText, { color: cardTheme.mutedText }]} numberOfLines={1}>
                {statusLine}
              </Text>
            )}
          </View>

          {/* Address */}
          <TouchableOpacity
            onPress={() => handleCopyAddress(item.id, displayAddress)}
            activeOpacity={0.85}
            style={[
              styles.cardAddressRow,
              {
                borderTopColor: cardTheme.light
                  ? 'rgba(0,0,0,0.10)'
                  : 'rgba(255,255,255,0.18)',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Copy address"
          >
            <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.addressText, { color: cardTheme.text }]}>
              {displayAddressShort}
            </Text>
            <View style={styles.copyArea}>
              {isCopied ? (
                <Text style={[styles.copiedLabel, { color: cardTheme.text }]}>Copied</Text>
              ) : (
                <MaterialCommunityIcons
                  name="content-copy"
                  size={16}
                  color={cardTheme.text}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [
      copiedWalletId,
      getDisplayAddress,
      activeCoin,
      balances,
      balanceErrors,
      info,
      showBalance,
      displayTicker,
      cardTheme,
      handleCopyAddress,
      getWalletFiatDisplay,
    ],
  );

  return (
    <View style={styles.container}>
      {/* Address selector label */}
      <View style={styles.selectorHeader}>
        <Text style={styles.selectorLabel}>{'Addresses'}</Text>
        {walletItems.length > 1 && (
          <Text style={styles.selectorCount}>{`${activeIndex + 1}/${walletItems.length}`}</Text>
        )}
      </View>

      {/* Wallet Cards Carousel */}
      <FlatList
        ref={flatListRef}
        data={walletItems}
        renderItem={renderWalletCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING }} />}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
        snapToAlignment="start"
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + CARD_SPACING,
          offset: (CARD_WIDTH + CARD_SPACING) * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingBottom: 12,
  },
  carouselContent: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 0,
    paddingBottom: 8,
  },
  walletCard: {
    height: CARD_HEIGHT,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  networkWatermark: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkWatermarkText: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: 0.8,
  },
  cardAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  addressText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
    marginRight: 12,
    lineHeight: 18,
  },
  copyArea: {
    width: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  copiedLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTAINER_PADDING,
    paddingBottom: 8,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.verusDarkGray,
  },
  selectorCount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.verusDarkGray,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  amountSection: {
    paddingRight: 8,
    flex: 1,
    justifyContent: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
  },
  amountText: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  tickerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fiatText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default DynamicHeader;
