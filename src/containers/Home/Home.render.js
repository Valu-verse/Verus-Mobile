// Home.render.js
// 2025-11-21: Tightened header spacing and sized Crypto quick action button + manage sheet trigger.
// 2025-11-22: Inlined the balance visibility toggle, removed reliance on the stack header, and added SafeAreaView
//             padding so hero balances never overlap iPhone notches.
// 2026-01-09: Removed Crypto/Identities header tabs from Wallet; keep the + manage-assets button.
// 2026-01-09: (Option B) Moved the manage-assets action into the top balance row next to the eye toggle
//             and switched the "+" to an icon-only action for visual parity.
// 2026-01-09: Added a conditional hairline divider under the header that appears only when the asset list scrolls.

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import BuySellSheet from '../Services/ServiceComponents/ValuService/BuySellSheet/BuySellSheet';
import HomeFAB from './HomeFAB/HomeFAB';
import TransferSheet from './HomeFAB/TransferSheet';
import TotalUniBalanceWidget from './HomeWidgets/TotalUniBalanceWidget';
import ListSelectionModal from '../../components/ListSelectionModal/ListSelectionModal';
import {
  CURRENCY_NAMES,
  SUPPORTED_UNIVERSAL_DISPLAY_CURRENCIES,
} from '../../utils/constants/currencies';
import NotificationWidget from './HomeWidgets/NotificationWidget';
import Colors from '../../globals/colors';
import AssetsRender from '../Assets/Assets.render';
import ManageAssetsSheet from './HomeFAB/ManageAssetsSheet';
import BalanceVisibilityToggle from './HomeWidgets/BalanceVisibilityToggle';

const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
const headerDividerThreshold = 1;

export const HomeRender = ({
  displayCurrencyModalOpen,
  displayCurrency,
  setDisplayCurrency,
  setDisplayCurrencyModalOpen,
  _addCoin,
  _verusPay,
  _addPbaasCurrency,
  _addErc20Token,
  handleOpenOnOffRamp,
  buySellSheetVisible,
  setBuySellSheetVisible,
  handleBuySellComplete,
  handleTransferPress,
  transferSheetVisible,
  setTransferSheetVisible,
  handleTransferReceive,
  handleTransferSendConvert,
  forceUpdate,
  loading,
  assets,
  showBalance,
  openCoin,
  manageVisible,
  setManageVisible,
  hasValuProofOfPersonhood,
}) => {
  const [widgetVisible, setWidgetVisible] = React.useState(false);
  const [showHeaderDivider, setShowHeaderDivider] = React.useState(false);
  const showHeaderDividerRef = React.useRef(false);
  
  const totalFiatBalanceRaw = assets.reduce((sum, item) => sum + (item.fiat || 0), 0);
  const totalFiatBalance = (typeof totalFiatBalanceRaw === 'number' && !isNaN(totalFiatBalanceRaw)) ? totalFiatBalanceRaw : 0;

  const handleAssetListScroll = React.useCallback((event) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    const next = y > headerDividerThreshold;

    if (next !== showHeaderDividerRef.current) {
      showHeaderDividerRef.current = next;
      setShowHeaderDivider(next);
    }
  }, []);

  const fixedHeader = (
    <View style={[styles.headerContainer, showHeaderDivider && styles.headerContainerScrolled]}>
      <View style={styles.balanceRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setDisplayCurrencyModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change display currency"
          style={styles.totalBalanceTouchable}
        >
          <TotalUniBalanceWidget totalBalance={totalFiatBalance} /> 
        </TouchableOpacity>
        <View style={styles.balanceActions}>
          <BalanceVisibilityToggle style={styles.balanceToggle} />
          <TouchableOpacity
            onPress={() => setManageVisible(true)}
            hitSlop={iconHitSlop}
            accessibilityRole="button"
            accessibilityLabel="Manage assets"
            activeOpacity={0.75}
            style={styles.manageAssetsIconButton}
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color={Colors.verusDarkGray}
            />
          </TouchableOpacity>
        </View>
      </View>
      <NotificationWidget />
    </View>
  );

  const footerHeight = widgetVisible ? 260 : 140; 
  const listFooterComponent = <View style={{ height: footerHeight }} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Portal.Host>
        <Portal>
          {displayCurrencyModalOpen && (
            <ListSelectionModal
              title="Currencies"
              selectedKey={displayCurrency}
              visible={displayCurrencyModalOpen}
              onSelect={(item) => setDisplayCurrency(item.key)}
              data={SUPPORTED_UNIVERSAL_DISPLAY_CURRENCIES.map((key) => {
                return {
                  key,
                  title: key,
                  description: CURRENCY_NAMES[key],
                };
              })}
              cancel={() => setDisplayCurrencyModalOpen(false)}
            />
          )}
          {buySellSheetVisible && (
            <BuySellSheet
              visible={true}
              onClose={() => setBuySellSheetVisible(false)}
              onComplete={handleBuySellComplete}
            />
          )}
          {transferSheetVisible && (
            <TransferSheet
              visible={true}
              onClose={() => setTransferSheetVisible(false)}
              onSelectReceive={handleTransferReceive}
              onSelectSendConvert={handleTransferSendConvert}
            />
          )}
          <ManageAssetsSheet
            visible={manageVisible}
            onClose={() => setManageVisible(false)}
            showConfigureHomeCards={false}
            onBrowseAll={_addCoin}
            onAddErc20={_addErc20Token}
            onAddPbaas={_addPbaasCurrency}
            onArrangeCards={() => {}}
          />
        </Portal>
        {fixedHeader}
        <HomeFAB
          handleAddCoin={_addCoin}
          handleVerusPay={_verusPay}
          handleAddPbaasCurrency={_addPbaasCurrency}
          handleAddErc20Token={_addErc20Token}
          handleOpenOnOffRamp={handleOpenOnOffRamp}
          handleTransfer={handleTransferPress}
          hasValuProofOfPersonhood={hasValuProofOfPersonhood}
          onWidgetVisibilityChange={setWidgetVisible}
        />
        <AssetsRender.List
          assets={assets}
          displayCurrency={displayCurrency}
          showBalance={showBalance}
          onPressAsset={openCoin}
          onPressAddAssets={() => setManageVisible(true)}
          listHeaderComponent={null}
          listFooterComponent={listFooterComponent}
          showManageAssets={false}
          refreshing={loading}
          onRefresh={forceUpdate}
          onScroll={handleAssetListScroll}
          scrollEventThrottle={16}
        />
      </Portal.Host>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  headerContainerScrolled: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E4EA',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 8,
  },
  balanceToggle: {
    marginRight: 6,
  },
  balanceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    marginTop: 12,
  },
  totalBalanceTouchable: {
    flex: 1,
  },
  manageAssetsIconButton: {
    padding: 6,
  },
});
