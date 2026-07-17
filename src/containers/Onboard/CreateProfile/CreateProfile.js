/*
  Update (2025-10-02): Removed the blocking success alert shown after profile
  creation/import to reduce interruption. Errors still use alerts. No functional
  behavior change beyond eliminating the redundant success modal.
*/
import {createStackNavigator} from '@react-navigation/stack';
import React, {useEffect, useState} from 'react';
import {addCoin, addUser, setSuppressUnlockAutoBiometrics} from '../../../actions/actionCreators';
import {createAlert} from '../../../actions/actions/alert/dispatchers/alert';
import {CHANNELS, DLIGHT_PRIVATE, ELECTRUM, VALU_SERVICE} from '../../../utils/constants/intervalConstants';
import {hashAccountId} from '../../../utils/crypto/hash';
import {arrayToObject} from '../../../utils/objectManip';
import CreateWalletStackScreens from '../../CreateWallet/CreateWallet';
import ChooseName from './Forms/ChooseName';
import CreatePassword from './Forms/CreatePassword';
import ConfirmPassword from './Forms/ConfirmPassword';
import UseBiometrics from './Forms/UseBiometrics';
import {KEY_DERIVATION_VERSION, SERVICES_DISABLED_DEFAULT} from '../../../../env/index';
import {START_COINS, START_ERC20_TOKENS, START_ERC20_TOKENS_TESTNET, TEST_PROFILE_OVERRIDES} from '../../../utils/constants/constants';
import {getErc20CoinId} from '../../../utils/CoinData/CoinDirectory';
import {useDispatch} from 'react-redux';
import {
  closeLoadingModal,
  initializeAccountData,
  openLoadingModal,
} from '../../../actions/actionDispatchers';
import { deriveKeyPair } from '../../../utils/keys';
import { CoinDirectory } from '../../../utils/CoinData/CoinDirectory';
import { useObjectSelector } from '../../../hooks/useObjectSelector';
import { storeBiometricPassword } from '../../../utils/keychain/biometrics';

const CreateProfileStack = createStackNavigator();

export default function CreateProfileStackScreens(props) {
  const [profileName, setProfileName] = useState('');
  const [password, setPassword] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(false);
  const dispatch = useDispatch();

  const accounts = useObjectSelector(state => state.authentication.accounts);
  const activeCoinList = useObjectSelector(state => state.coins.activeCoinList);

  const addStartingCoins = async (accountId, testnetOverrides = {}) => {
    const testAccount = Object.keys(testnetOverrides).length > 0;

    for (const coinId of START_COINS) {
      if (testAccount && testnetOverrides[coinId] == null) {
        continue;
      }

      const coinKey = testnetOverrides[coinId] ? testnetOverrides[coinId] : coinId;

      const fullCoinData = CoinDirectory.findCoinObj(coinKey, accountId);

      dispatch(await addCoin(fullCoinData, activeCoinList, accountId, []));
    }

    const erc20Tokens = testAccount ? START_ERC20_TOKENS_TESTNET : START_ERC20_TOKENS;
    for (const tokenDef of erc20Tokens) {
      try {
        await CoinDirectory.addErc20Token(tokenDef, tokenDef.network);
        const coinId = getErc20CoinId(tokenDef.address, tokenDef.network);
        const fullCoinData = CoinDirectory.findCoinObj(coinId, accountId);
        dispatch(await addCoin(fullCoinData, activeCoinList, accountId, []));
      } catch (e) {
        console.warn('Could not add default ERC20 token', tokenDef.symbol, e.message);
      }
    }
  };

  const createProfile = async (seed, testProfile, useSeedAsZ) => {
    openLoadingModal('Setting up your new profile...');

    try {
      const _userName = profileName;
      const _pin = password;
      const _seeds = {[ELECTRUM]: seed, [VALU_SERVICE]: seed};

      if (!testProfile && useSeedAsZ) {
        _seeds[DLIGHT_PRIVATE] = seed;
      }

      try {
        for (const startCoin of START_COINS) {
          await deriveKeyPair(
            seed,
            CoinDirectory.findCoinObj(startCoin),
            ELECTRUM,
            KEY_DERIVATION_VERSION,
          );
        }
      } catch(e) {
        throw new Error(`Could not create keypair from seed: ${e.message}`);
      }

      if (_seeds[ELECTRUM] == null) {
        throw new Error('Please configure at least a primary seed.');
      }

      let biometry = false;
      const accountHash = hashAccountId(_userName);

      if (accounts.find(x => x.accountHash === accountHash) != null) {
        throw new Error('Cannot create duplicate account.');
      }

      if (useBiometrics) {
        try {
          await storeBiometricPassword(accountHash, _pin);
          biometry = true;
        } catch (e) {
          console.warn(e);
        }
      }

      const overrides = testProfile ? TEST_PROFILE_OVERRIDES : undefined

      const action = await addUser(
        _userName,
        arrayToObject(CHANNELS, (acc, channel) => _seeds[channel], true),
        _pin,
        accounts,
        biometry,
        KEY_DERIVATION_VERSION,
        SERVICES_DISABLED_DEFAULT,
        overrides
      );

      dispatch(setSuppressUnlockAutoBiometrics(true));
      dispatch(action);
      await addStartingCoins(_userName, overrides);

      const newAccount = action.payload.accounts.find(
        x => x.accountHash === accountHash,
      );

      if (!newAccount) {
        throw new Error('Failed to create new account');
      }

      //Log in new user
      await initializeAccountData(newAccount, _pin);
    } catch (e) {
      console.error(e)
      createAlert('Error', e.message);
    }

    closeLoadingModal();
  };

  return (
    <CreateProfileStack.Navigator>
      <CreateProfileStack.Screen
        name="ChooseName"
        options={{
          headerShown: false,
        }}>
        {() => (
          <ChooseName
            profileName={profileName}
            setProfileName={setProfileName}
            navigation={props.navigation}
          />
        )}
      </CreateProfileStack.Screen>
      <CreateProfileStack.Screen
        name="CreatePassword"
        options={{
          headerShown: false,
        }}>
        {() => (
          <CreatePassword
            password={password}
            setPassword={setPassword}
            navigation={props.navigation}
          />
        )}
      </CreateProfileStack.Screen>
      <CreateProfileStack.Screen
        name="ConfirmPassword"
        options={{
          headerShown: false,
        }}>
        {() => (
          <ConfirmPassword
            password={password}
            setPassword={setPassword}
            navigation={props.navigation}
          />
        )}
      </CreateProfileStack.Screen>
      <CreateProfileStack.Screen
        name="UseBiometrics"
        options={{
          headerShown: false,
        }}>
        {() => (
          <UseBiometrics
            useBiometrics={useBiometrics}
            setUseBiometrics={setUseBiometrics}
            navigation={props.navigation}
          />
        )}
      </CreateProfileStack.Screen>
      <CreateProfileStack.Screen
        name="CreateWallet"
        options={{
          headerShown: false,
        }}>
        {() => (
          <CreateWalletStackScreens
            navigation={props.navigation}
            createProfile={createProfile}
          />
        )}
      </CreateProfileStack.Screen>
    </CreateProfileStack.Navigator>
  );
}
