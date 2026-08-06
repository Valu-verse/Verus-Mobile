/**
 * useUsdcBridgeWatcher.js
 * Watches the user's EVM USDC balance and fires / clears a bridge notification.
 *
 * - Mainnet profile  → watches ETH USDC  (0xA0b8...)
 * - Testnet profile  → watches Polygon Amoy USDC  (matic-amoy:0x41E9...)
 *
 * The notification appears in the NotificationWidget and links to UsdcBridgeScreen.
 * It is dismissed automatically when the balance drops to zero.
 */
import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import BigNumber from 'bignumber.js';
import {
  USDC_ETH_MAINNET_COIN_ID,
  USDC_POLYGON_AMOY_COIN_ID,
} from '../utils/constants/constants';
import {
  NOTIFICATION_TYPE_USDC_BRIDGE,
} from '../utils/constants/notifications';
import { UsdcBridgeNotification } from '../utils/notification';
import {
  dispatchAddNotification,
  dispatchRemoveNotification,
} from '../actions/actions/notifications/dispatchers/notifications';
import { useObjectSelector } from './useObjectSelector';
import { extractLedgerData } from '../utils/ledger/extractLedgerData';
import { API_GET_BALANCES } from '../utils/constants/intervalConstants';

// One notification per user — stable UID so we can find & remove it
const USDC_BRIDGE_NOTIFICATION_UID = 'usdc-bridge-watcher';

export const useUsdcBridgeWatcher = () => {
  const activeAccount = useObjectSelector(
    (state) => state.authentication.activeAccount,
  );
  const notifications = useObjectSelector((state) => state.notifications);
  const balances = useObjectSelector((state) =>
    extractLedgerData(state, 'balances', API_GET_BALANCES),
  );
  const activeCoinsForUser = useObjectSelector(
    (state) => state.coins.activeCoinsForUser,
  );
  const allSubWallets = useObjectSelector(
    (state) => state.coinMenus?.activeSubWallets ?? {},
  );

  const isTestnet =
    activeAccount?.testnetOverrides &&
    Object.keys(activeAccount.testnetOverrides).length > 0;

  const usdcCoinId = isTestnet
    ? USDC_POLYGON_AMOY_COIN_ID
    : USDC_ETH_MAINNET_COIN_ID;

  const acchash = activeAccount?.accountHash ?? null;

  // Ref to track last notified balance to avoid firing on every render
  const lastNotifiedBalance = useRef(null);

  useEffect(() => {
    if (!acchash) return;

    // Check if USDC coin is in the user's active list
    const usdcCoin = activeCoinsForUser.find((c) => c.id === usdcCoinId);
    if (!usdcCoin) {
      // Coin not added — clean up any stale notification
      _clearNotification(acchash, notifications);
      lastNotifiedBalance.current = null;
      return;
    }

    // Sum balance across all sub-wallets for this coin
    const coinBalances = balances[usdcCoinId] ?? {};
    let totalBalance = BigNumber(0);
    Object.values(coinBalances).forEach((walletBal) => {
      if (walletBal?.total != null) {
        totalBalance = totalBalance.plus(BigNumber(walletBal.total));
      }
    });

    const hasBalance = totalBalance.isGreaterThan(0);
    const balanceStr = totalBalance.toFixed(6);

    // Check if a USDC bridge notification already exists for this account
    const existingUid = _findExistingNotificationUid(acchash, notifications);

    if (hasBalance) {
      // Only fire/update if balance changed
      if (lastNotifiedBalance.current !== balanceStr) {
        lastNotifiedBalance.current = balanceStr;

        // Remove old notification so we can create a fresh one with updated balance
        if (existingUid) {
          dispatchRemoveNotification(existingUid);
        }

        const formattedBalance = totalBalance
          .decimalPlaces(4, BigNumber.ROUND_DOWN)
          .toFixed(4);

        const notification = new UsdcBridgeNotification(
          'send to Verus',
          [`You have ${formattedBalance} USDC`, '— tap to send it to Verus'],
          USDC_BRIDGE_NOTIFICATION_UID + '-' + acchash,
          acchash,
          usdcCoinId,
          totalBalance.toNumber(),
        );

        dispatchAddNotification(notification);
      }
    } else {
      // Balance is zero — remove notification if present
      if (existingUid) {
        dispatchRemoveNotification(existingUid);
      }
      lastNotifiedBalance.current = null;
    }
  }, [balances, activeCoinsForUser, acchash, usdcCoinId, notifications]);
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function _findExistingNotificationUid(acchash, notifications) {
  if (!notifications?.directory) return null;
  const entry = Object.entries(notifications.directory).find(
    ([_, v]) => v.acchash === acchash && v.type === NOTIFICATION_TYPE_USDC_BRIDGE,
  );
  return entry ? entry[0] : null;
}

function _clearNotification(acchash, notifications) {
  const uid = _findExistingNotificationUid(acchash, notifications);
  if (uid) dispatchRemoveNotification(uid);
}
