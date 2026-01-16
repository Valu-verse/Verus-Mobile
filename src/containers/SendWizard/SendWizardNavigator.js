/*
  SendWizardNavigator
  - Nested stack navigator for the send wizard flow
  - Wraps all wizard screens with SendWizardProvider context
  - Created 2024-12-09
  - Updated 2026-01-15: Preselect source in navigator and start on the target
    step when initial params are available to avoid flashing the source step.
  - Updated 2025-12-11: Added support for initialCoinId and initialSubWalletId params
    to pre-select source when navigating from asset overview screen.
  - Updated 2024-12-15: Added SendWizardSuccess screen
*/

import React, { useMemo } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { SendWizardProvider } from './SendWizardContext';
import SendWizardSelectSource from './SendWizardSelectSource';
import SendWizardSelectTarget from './SendWizardSelectTarget';
import SendWizardAmount from './SendWizardAmount';
import SendWizardRecipient from './SendWizardRecipient';
import SendWizardConfirm from './SendWizardConfirm';
import SendWizardSuccess from './SendWizardSuccess';
import { defaultHeaderOptions } from '../../utils/navigation/header';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { extractDisplaySubWallets } from '../../utils/subwallet/extractSubWallets';
import { extractLedgerData } from '../../utils/ledger/extractLedgerData';
import { API_GET_BALANCES, API_SEND } from '../../utils/constants/intervalConstants';

const Stack = createStackNavigator();

const SendWizardNavigator = () => {
  const route = useRoute();
  const initialParams = route.params || {};
  const { initialCoinId, initialSubWalletId } = initialParams;

  const activeCoinsForUser = useObjectSelector((state) => state.coins.activeCoinsForUser);
  const allSubWallets = useObjectSelector((state) => extractDisplaySubWallets(state));
  const balances = useObjectSelector((state) =>
    extractLedgerData(state, 'balances', API_GET_BALANCES),
  );

  const initialSource = useMemo(() => {
    if (!initialCoinId) return null;

    const coinObj = activeCoinsForUser.find((coin) => coin.id === initialCoinId);
    if (!coinObj) return null;

    const subWallets = allSubWallets[coinObj.id] || [];
    if (subWallets.length === 0) return null;

    let targetSubWallet = null;
    if (initialSubWalletId) {
      targetSubWallet = subWallets.find((wallet) => wallet.id === initialSubWalletId);
    }

    if (!targetSubWallet) {
      targetSubWallet = subWallets.find((wallet) => {
        const balance =
          balances[coinObj.id] &&
          balances[coinObj.id][wallet.id] &&
          balances[coinObj.id][wallet.id].total != null
            ? BigNumber(balances[coinObj.id][wallet.id].total)
            : BigNumber(0);
        return balance.isGreaterThan(0);
      });
    }

    if (!targetSubWallet) return null;

    const walletBalance =
      balances[coinObj.id] &&
      balances[coinObj.id][targetSubWallet.id] &&
      balances[coinObj.id][targetSubWallet.id].total != null
        ? balances[coinObj.id][targetSubWallet.id].total
        : 0;

    const channel = targetSubWallet.api_channels?.[API_SEND] || null;

    return {
      coin: coinObj,
      subWallet: targetSubWallet,
      balance: walletBalance,
      channel,
    };
  }, [
    initialCoinId,
    initialSubWalletId,
    activeCoinsForUser,
    allSubWallets,
    balances,
  ]);

  const initialRouteName = initialSource
    ? 'SendWizardSelectTarget'
    : 'SendWizardSelectSource';

  return (
    <SendWizardProvider initialParams={initialParams} initialSource={initialSource}>
      <Stack.Navigator
        screenOptions={defaultHeaderOptions}
        initialRouteName={initialRouteName}
      >
        <Stack.Screen
          name="SendWizardSelectSource"
          component={SendWizardSelectSource}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardSelectTarget"
          component={SendWizardSelectTarget}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardAmount"
          component={SendWizardAmount}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardRecipient"
          component={SendWizardRecipient}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardConfirm"
          component={SendWizardConfirm}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="SendWizardSuccess"
          component={SendWizardSuccess}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </SendWizardProvider>
  );
};

export default SendWizardNavigator;
