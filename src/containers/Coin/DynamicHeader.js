/*
  This component works as the active header for Coin Menu screens. Interacting
  with it by swiping or pressing will allow you to change your active sub-wallet.
  - Updated 2025-12-15:
    * Redesigned with smooth FlatList carousel for wallet selection.
    * Flat card design with minimal styling (network + address only).
    * Balance and action buttons moved outside cards.
    * Buttons styled like HomeFAB (GradientButton + outlined).
    * Total balance moved to parent component header.
*/

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Clipboard, FlatList, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { setCoinSubWallet } from '../../actions/actionCreators';
import {
  API_GET_BALANCES,
  API_GET_FIATPRICE,
  API_GET_INFO,
  API_GET_ADDRESSES,
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
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import { getNetworkDisplayName, getNetworkIcon } from '../SendWizard/sendWizardDisplayInfo';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SPACING = 12;
const CONTAINER_PADDING = 20;
const CARD_WIDTH = SCREEN_WIDTH - (CONTAINER_PADDING * 2) - 32;

const DynamicHeader = () => {
  const dispatch = useDispatch();
  const flatListRef = useRef(null);

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

  const walletItems = useMemo(() => {
    if (!allSubWallets || allSubWallets.length === 0) return [];
    return allSubWallets.map((wallet, index) => ({ ...wallet, index }));
  }, [allSubWallets]);

  useEffect(() => {
    if (selectedSubWallet && walletItems.length > 0) {
      const index = walletItems.findIndex((w) => w.id === selectedSubWallet.id);
      if (index !== -1 && index !== activeIndex) {
        setActiveIndex(index);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: false });
        }, 100);
      }
    }
  }, [selectedSubWallet, walletItems]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const activeWallet = walletItems[activeIndex] || null;
  
  const activeWalletBalance = useMemo(() => {
    if (!activeWallet || !balances[activeWallet.id]) return null;
    return balances[activeWallet.id].confirmed;
  }, [activeWallet, balances]);

  const activeWalletPending = useMemo(() => {
    if (!activeWallet || !balances[activeWallet.id]) return null;
    return balances[activeWallet.id].pending;
  }, [activeWallet, balances]);

  const activeWalletFiat = useMemo(() => {
    if (!activeWallet || activeWalletBalance == null) return null;
    const ratesForChannel =
      rates[activeWallet.api_channels[API_GET_FIATPRICE]] != null
        ? rates[activeWallet.api_channels[API_GET_FIATPRICE]][chainTicker]
        : null;
    if (ratesForChannel && ratesForChannel[displayCurrency] != null) {
      const price = BigNumber(ratesForChannel[displayCurrency]);
      return BigNumber(activeWalletBalance).multipliedBy(price).toFixed(2);
    }
    return null;
  }, [activeWallet, activeWalletBalance, rates, chainTicker, displayCurrency]);

  const activeWalletSyncProgress = useMemo(() => {
    if (!activeWallet || !info || !info[activeWallet.id]) return 100;
    return info[activeWallet.id].percent;
  }, [activeWallet, info]);

  const activeWalletHasError = activeWallet ? balanceErrors[activeWallet.id] : false;
  const hasPendingBalance = activeWalletPending != null && !BigNumber(activeWalletPending).isEqualTo(0);
  const syncLabel =
    activeWalletSyncProgress !== 100 && activeWalletSyncProgress !== -1
      ? `Syncing ${activeWalletSyncProgress.toFixed(0)}%`
      : null;

  const handleScrollEnd = useCallback(
    (event) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
      const clampedIndex = Math.max(0, Math.min(newIndex, walletItems.length - 1));
      
      if (clampedIndex !== activeIndex) {
        setActiveIndex(clampedIndex);
        const wallet = walletItems[clampedIndex];
        if (wallet) {
          dispatch(setCoinSubWallet(chainTicker, wallet));
        }
      }
    },
    [activeIndex, walletItems, chainTicker, dispatch],
  );

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

  const renderWalletCard = useCallback(
    ({ item, index }) => {
      const isActive = index === activeIndex;
      const isCopied = copiedWalletId === item.id;
      
      // Try to get address from activeAccount keys using the subwallet's address channel
      // If it's a VerusID (ends with @), use the name directly.
      // Otherwise, look up the crypto address (e.g. for "Main" wallet).
      let displayAddress = item.name || '-';
      const isVerusId = item.name && item.name.endsWith('@');

      if (!isVerusId) {
        const addressChannel = item.api_channels[API_GET_ADDRESSES];
        
        if (
          activeAccount && 
          activeAccount.keys[chainTicker] && 
          activeAccount.keys[chainTicker][addressChannel] &&
          activeAccount.keys[chainTicker][addressChannel].addresses.length > 0
        ) {
          displayAddress = activeAccount.keys[chainTicker][addressChannel].addresses[0];
        }
      }

      const networkName = getNetworkDisplayName(item.network);
      const networkIconId = getNetworkIcon(item.network);
      const isVerusOrPbaas = activeCoin?.proto === 'vrsc';

      return (
        <View style={[styles.walletCard, { width: CARD_WIDTH }]}>
          {/* Network row - only show for Verus/PBaaS chains where it's useful */}
          {isVerusOrPbaas && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Network</Text>
              <View style={styles.networkValue}>
                {RenderSquareCoinLogo(networkIconId, {}, 16, 16)}
                <Text style={styles.networkText}>{networkName}</Text>
              </View>
            </View>
          )}

          {/* Address row */}
          <TouchableOpacity
            onPress={() => handleCopyAddress(item.id, displayAddress)}
            activeOpacity={0.7}
            style={styles.cardRow}
            accessibilityRole="button"
            accessibilityLabel="Copy address"
          >
            <Text style={styles.cardLabel}>Address</Text>
            <View style={styles.addressValueRow}>
              <Text numberOfLines={1} ellipsizeMode="middle" style={styles.addressText}>
                {displayAddress}
              </Text>
              <View style={styles.copyArea}>
                {isCopied ? (
                  <Text style={styles.copiedLabel}>Copied</Text>
                ) : (
                  <MaterialCommunityIcons
                    name="content-copy"
                    size={16}
                    color={Colors.verusDarkGray}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [activeIndex, copiedWalletId, handleCopyAddress, activeAccount, chainTicker, activeCoin],
  );

  const renderPageDots = () => {
    if (walletItems.length <= 1) return null;
    return (
      <View style={styles.dotsContainer}>
        {walletItems.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
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

      {/* Page Indicator Dots */}
      {renderPageDots()}

      {/* Balance Section */}
      <View style={styles.balanceSection}>
        {!showBalance ? (
          <Text style={styles.balanceHidden}>********* {displayTicker}</Text>
        ) : (
          <>
            <View style={styles.balanceMainRow}>
              <Text style={styles.balanceAmount}>
                {activeWalletHasError
                  ? CONNECTION_ERROR
                  : activeWalletBalance == null
                  ? '-'
                  : truncateDecimal(activeWalletBalance, 8)}
              </Text>
              {!activeWalletHasError && (
                <Text style={styles.balanceTicker}> {displayTicker}</Text>
              )}
            </View>
            <Text style={styles.balanceFiat}>
              {activeWalletFiat == null
                ? '-'
                : formatCurrency({ amount: activeWalletFiat, code: displayCurrency })[0]}
            </Text>
            {(hasPendingBalance || syncLabel) && (
              <View style={styles.statusRow}>
                {hasPendingBalance && showBalance && (
                  <Text style={styles.statusText}>
                    {`${BigNumber(activeWalletPending).isGreaterThan(0) ? '+' : ''}${truncateDecimal(
                      activeWalletPending,
                      8,
                    )} pending`}
                  </Text>
                )}
                {syncLabel && <Text style={styles.statusText}>{syncLabel}</Text>}
              </View>
            )}
          </>
        )}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.secondaryColor,
    paddingBottom: 16,
  },
  carouselContent: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 4,
    paddingBottom: 12,
  },
  walletCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center', // Center content vertically if card height allows
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10, // Increased vertical padding for better spacing
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.verusDarkGray,
  },
  networkValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.quaternaryColor,
    marginLeft: 6,
    lineHeight: 18,
  },
  addressValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 16,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.quaternaryColor,
    flex: 1,
    textAlign: 'right',
    marginRight: 8,
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
    color: Colors.verusGreenColor,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: Colors.primaryColor,
  },
  dotInactive: {
    backgroundColor: '#D0D0D0',
  },
  balanceSection: {
    alignItems: 'center',
    paddingHorizontal: CONTAINER_PADDING,
    marginBottom: 20,
  },
  balanceHidden: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.quaternaryColor,
  },
  balanceMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.quaternaryColor,
  },
  balanceTicker: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.verusDarkGray,
  },
  balanceFiat: {
    fontSize: 16,
    color: Colors.verusDarkGray,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.verusDarkGray,
    marginHorizontal: 8,
  },
});

export default DynamicHeader;
