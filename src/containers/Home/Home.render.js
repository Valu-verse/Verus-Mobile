// Home.render.js
// 2025-11-21: Tightened header spacing and sized Crypto quick action button + manage sheet trigger.
// 2025-11-22: Inlined the balance visibility toggle, removed reliance on the stack header, and added SafeAreaView
//             padding so hero balances never overlap iPhone notches.

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Provider, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import BuySellSheet from '../Services/ServiceComponents/ValuService/BuySellSheet/BuySellSheet';
import { HomeListItemThemeLight } from './Home.themes';
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
  activeCategory,
  setActiveCategory,
  identities,
  identitiesPlaceholder,
  hasValuProofOfPersonhood,
}) => {
  const [widgetVisible, setWidgetVisible] = React.useState(false);
  
  const totalFiatBalanceRaw = assets.reduce((sum, item) => sum + (item.fiat || 0), 0);
  const totalFiatBalance = (typeof totalFiatBalanceRaw === 'number' && !isNaN(totalFiatBalanceRaw)) ? totalFiatBalanceRaw : 0;

  const isCrypto = activeCategory === 'crypto';
  const data = isCrypto ? assets : identities;
  const fixedHeader = (
    <View style={styles.headerContainer}>
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
        <BalanceVisibilityToggle style={styles.balanceToggle} />
      </View>
      <NotificationWidget />
      <View style={styles.tabsWrapper}>
        <View style={styles.tabsRow}>
          <View style={styles.tabButtonsContainer}>
            {[
              { key: 'crypto', label: 'Crypto' },
              { key: 'identities', label: 'Identities' },
            ].map((tab) => {
              const selected = activeCategory === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.85}
                  style={[styles.tabButton, selected && styles.tabButtonSelected]}
                  onPress={() => {
                    if (!selected) {
                      setActiveCategory(tab.key);
                    }
                  }}
                >
                  <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.label}</Text>
                  <View style={[styles.tabUnderline, selected && styles.tabUnderlineSelected]} />
                </TouchableOpacity>
              );
            })}
          </View>
          {isCrypto ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.tabActionButton}
              accessibilityRole="button"
              accessibilityLabel="Manage assets"
              onPress={() => setManageVisible(true)}
            >
              <Text style={styles.tabActionPlus}>+</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );

  const footerHeight = widgetVisible ? 260 : 140; 
  const listFooterComponent = <View style={{ height: footerHeight }} />;
  const listEmptyComponent = !isCrypto ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No identities yet</Text>
      <Text style={styles.emptySubtitle}>{identitiesPlaceholder}</Text>
    </View>
  ) : null;

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
          assets={data}
          displayCurrency={displayCurrency}
          showBalance={showBalance}
          onPressAsset={isCrypto ? openCoin : undefined}
          onPressAddAssets={isCrypto ? () => setManageVisible(true) : undefined}
          listHeaderComponent={null}
          listFooterComponent={listFooterComponent}
          showManageAssets={false}
          emptyComponent={listEmptyComponent}
          refreshing={loading}
          onRefresh={forceUpdate}
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
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 8,
  },
  balanceToggle: {
    marginLeft: 8,
    marginTop: 12,
  },
  totalBalanceTouchable: {
    flex: 1,
  },
  tabsWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E4EA',
    position: 'relative',
    marginTop: -4,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  tabButtonsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    paddingVertical: 10,
    marginRight: 24,
    position: 'relative',
  },
  tabButtonSelected: {},
  tabLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5F6A7A',
  },
  tabLabelSelected: {
    color: Colors.primaryColor,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -4 - StyleSheet.hairlineWidth, // Push down to overlap the border (4px padding + linewidth)
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  tabUnderlineSelected: {
    backgroundColor: Colors.primaryColor,
  },
  tabActionButton: {
    width: 36,
    height: 36,
    borderRadius: 21.6,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  tabActionPlus: {
    fontSize: 26,
    color: '#333333',
    fontWeight: '600',
    marginTop: -2,
  },
  emptyState: {
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1F24',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#5F6A7A',
    lineHeight: 20,
  },
});
