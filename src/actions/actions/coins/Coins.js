import { 
  setCoinList,
  setCurrentUserCoins,
 } from '../../actionCreators';
import {
  storeCoins,
  getActiveCoinList
} from '../../../utils/asyncStore/asyncStore';
import {
  DLIGHT_PRIVATE,
  ETH,
  ERC20,
  ELECTRUM,
  GENERAL,
  WYRE_SERVICE,
  VRPC,
  VERUSID,
  VALU_SERVICE
} from "../../../utils/constants/intervalConstants";
import { initDlightWallet, closeDlightWallet } from '../channels/dlight/dispatchers/LightWalletReduxManager';
import { initEthWallet, closeEthWallet } from '../channels/eth/dispatchers/EthWalletReduxManager';
import { initErc20Wallet, closeErc20Wallet } from '../channels/erc20/dispatchers/Erc20WalletReduxManager';
import { initElectrumWallet, closeElectrumWallet } from '../channels/electrum/dispatchers/ElectrumWalletReduxManager';
import { initGeneralWallet, closeGeneralWallet } from '../channels/general/dispatchers/GeneralWalletReduxManager';
import { closeVrpcWallet, initVrpcWallet } from '../channels/vrpc/dispatchers/VrpcWalletReduxManager';
import { DISABLED_CHANNELS } from '../../../../env/index'
import store from '../../../store';
import { throwError } from '../../../utils/errors';
import { INACTIVE_COIN } from '../../../utils/constants/errors';
import {
  closeWyreCoinWallet,
  initWyreCoinChannel
} from "../channels/wyre/dispatchers/WyreWalletReduxManager";
import { initValuCoinChannel, closeValuCoinWallet } from '../channels/valu/dispatchers/ValuWalletReduxManager';
import { closeVerusIdWallet, initVerusIdWallet } from '../channels/verusid/dispatchers/VerusidWalletReduxManager';

export const COIN_MANAGER_MAP = {
  initializers: {
    [ETH]: initEthWallet,
    [ERC20]: initErc20Wallet,
    [VRPC]: initVrpcWallet,
    [VERUSID]: initVerusIdWallet,
    [ELECTRUM]: initElectrumWallet,
    [DLIGHT_PRIVATE]: initDlightWallet,
    [GENERAL]: initGeneralWallet,
    [WYRE_SERVICE]: initWyreCoinChannel,
    [VALU_SERVICE]: initValuCoinChannel
  },
  closers: {
    [ETH]: closeEthWallet,
    [ERC20]: closeErc20Wallet,
    [VRPC]: closeVrpcWallet,
    [VERUSID]: closeVerusIdWallet,
    [ELECTRUM]: closeElectrumWallet,
    [DLIGHT_PRIVATE]: closeDlightWallet,
    [GENERAL]: closeGeneralWallet,
    [WYRE_SERVICE]: closeWyreCoinWallet,
    [VALU_SERVICE]: closeValuCoinWallet
  }
}

// Add coin by saving it to localstorage, and optionally intialize dlight backend
export const addCoin = (fullCoinObj, activeCoins, userName, channels) => {
  let coinIndex = activeCoins.findIndex(x => x.id === fullCoinObj.id);
  let initializers = []

  Object.keys(COIN_MANAGER_MAP.initializers).map(channel => {
    if (channels.includes(channel)) {
      initializers.push(COIN_MANAGER_MAP.initializers[channel](fullCoinObj))
    }
  })
  
  if (coinIndex > -1) {
    if (activeCoins[coinIndex].users.includes(userName)) {
      return new Promise((resolve, reject) => {
        Promise.all(initializers)
        .then(() => {
          resolve(setCoinList(activeCoins))
        })
        .catch(err => reject(err))
      });
    }
    else {
      activeCoins[coinIndex].users.push(userName);
      return new Promise((resolve, reject) => {
        storeCoins(activeCoins)
        .then(() => {
          return Promise.all(initializers)
        })
        .then(() => {
          resolve(setCoinList(activeCoins))
        })
        .catch(err => reject(err))
      });
    }
  }
  else {
    activeCoins.push({...fullCoinObj, users: [userName]});
    return new Promise((resolve, reject) => {
      storeCoins(activeCoins)
      .then(() => {
        return Promise.all(initializers)
      })
      .then(() => {
        resolve(setCoinList(activeCoins))
      })
      .catch(err => reject(err))
    });
  }
}

// Remove a user's name from an active coin, or removes from all if coinID is 
// null
export const removeExistingCoin = async (coinID, userName, dispatch, deleteWallet = false) => {
  const state = store.getState()
  const activeCoins = state.coins.activeCoinList
  
  const removeWithIndex = (coinIndex) => {
    if (coinIndex > -1 && activeCoins[coinIndex].users.includes(userName)) {
      let userIndex = activeCoins[coinIndex].users.findIndex(n => n === userName);
      let closers = []
  
      Object.keys(COIN_MANAGER_MAP.closers).map(channel => {
        if (
          activeCoins[coinIndex].compatible_channels.includes(channel) &&
          !DISABLED_CHANNELS.includes(channel)
        ) {
          closers.push(
            COIN_MANAGER_MAP.closers[channel](
              activeCoins[coinIndex],
              deleteWallet
            )
          );
        }
      })
  
      activeCoins[coinIndex].users.splice(userIndex, 1)
  
      return new Promise((resolve, reject) => {
        storeCoins(activeCoins)
        .then(() => {
          return Promise.all(closers)
        })
        .then(() => {
          resolve(setCoinList(activeCoins))
        })
        .catch(err => reject(err))
      });
    } else throwError("Inactive coin", INACTIVE_COIN)
  }
  
  if (coinID != null) {
    let index = activeCoins.findIndex(x => x.id === coinID);

    try {
      dispatch(await removeWithIndex(index))
    } catch(e) {
      if (e.name !== INACTIVE_COIN) throw e
    }
  } else {
    for (let i = 0; i < activeCoins.length; i++) {
      try {
        dispatch(await removeWithIndex(i))
      } catch(e) {
        if (e.name !== INACTIVE_COIN) throw e
      }
    }
  }
}

export const fetchActiveCoins = () => {
  return new Promise((resolve, reject) => {
    getActiveCoinList()
      .then(res => {
        resolve(setCoinList(res))
      })
      .catch(err => reject(err));
  });
}

const ERC20_NETWORK_DISPLAY_NAMES = {
  'homestead': 'Ethereum', 'goerli': 'Goerli Testnet', 'sepolia': 'Sepolia Testnet',
  'matic': 'Polygon', 'matic-amoy': 'Polygon Amoy',
};

// Returns the canonical (preferred) ID for an ERC20 token on a given network
const getCanonicalErc20Id = (currencyId, network) => {
  const ETH_NATIVE = ['homestead', 'goerli', 'sepolia'];
  if (ETH_NATIVE.includes(network)) return currencyId;
  return `${network}:${currencyId}`;
};

// Applies display_name migration to a coin object (returns a new object)
const migrateErc20DisplayName = (coin) => {
  if (coin.proto !== 'erc20' || !coin.network || coin.display_name?.includes(' on ')) return coin;
  const networkDisplayName = ERC20_NETWORK_DISPLAY_NAMES[coin.network] || coin.network;
  const baseName = (coin.display_name && coin.display_name.trim()) ? coin.display_name : coin.display_ticker;
  return { ...coin, display_name: `${baseName} on ${networkDisplayName}` };
};

// Resolves the network for an ERC20 coin, inferring homestead for non-testnet coins without a stored network
const resolveErc20Network = (entry) => {
  if (entry.network) return entry.network;
  if (entry.proto === 'erc20' && !entry.testnet) return 'homestead';
  return null;
};

export const setUserCoins = (activeCoinList, userName) => {
  let result = [];
  // Tracks the best candidate for each ERC20 (currency_id + network) pair
  const erc20BestMap = new Map();

  for (let i = 0; i < activeCoinList.length; i++) {
    const entry = activeCoinList[i];
    if (!entry.users.includes(userName)) continue;

    if (entry.proto === 'erc20' && entry.currency_id) {
      const resolvedNetwork = resolveErc20Network(entry);

      if (resolvedNetwork) {
        const mapKey = `${entry.currency_id}:${resolvedNetwork}`;
        // Use entry with the resolved network so migration can use it
        const entryWithNetwork = resolvedNetwork !== entry.network
          ? { ...entry, network: resolvedNetwork }
          : entry;
        const canonicalId = getCanonicalErc20Id(entry.currency_id, resolvedNetwork);
        const existing = erc20BestMap.get(mapKey);
        if (!existing || entry.id === canonicalId) {
          erc20BestMap.set(mapKey, entryWithNetwork);
        }
      } else {
        result.push(migrateErc20DisplayName(entry));
      }
    } else {
      result.push(entry);
    }
  }

  // Add the best ERC20 candidate for each (currency_id, network) pair
  for (const coin of erc20BestMap.values()) {
    result.push(migrateErc20DisplayName(coin));
  }

  // If duplicates were removed, persist the cleaned list back to storage
  const keptIds = new Set(result.map(c => c.id));
  const cleanedList = activeCoinList.filter(
    entry => !entry.users.includes(userName) || keptIds.has(entry.id)
  );
  if (cleanedList.length < activeCoinList.length) {
    storeCoins(cleanedList).catch(e => console.warn('Failed to persist ERC20 deduplication', e));
  }

  return setCurrentUserCoins(result);
}

