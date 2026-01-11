/*
  sendWizardDisplayInfo.js
  - Display name mappings for the Send Wizard
  - Maps system IDs to user-friendly names, icons, and address types
  - Created 2024-12-09
  - Updated 2024-12-10: getNetworkIcon now looks up icons from coinsList/CoinDirectory
  - Updated 2024-12-17: getDestinationAddressType now considers sourceCoinProto so
    ETH/ERC20 simple sends correctly require Ethereum 0x addresses
  - Updated 2024-12-17: getNetworkIcon and getNetworkDisplayName now handle '.eth'
    system_id used by native ETH/ERC20 coins (maps to 'ETH' icon / 'Ethereum' name)
*/

import { coinsList } from '../../utils/CoinData/CoinsList';

// Address types for validation and input
export const ADDRESS_TYPE = {
  VERUS: 'verus',     // R-address, i-address, VerusID
  ETHEREUM: 'ethereum', // 0x addresses
};

// Network/System display info - maps system IDs to user-friendly display
export const NETWORK_DISPLAY = {
  // VRSC mainnet
  'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV': {
    name: 'Verus',
    icon: 'VRSC',
    addressType: ADDRESS_TYPE.VERUS,
    addressPlaceholder: 'R-address, i-address, or VerusID',
    addressHint: 'Enter a Verus R-address, i-address, or VerusID (ending with @)',
  },
  // VRSC testnet
  'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq': {
    name: 'Verus Testnet',
    icon: 'VRSCTEST',
    addressType: ADDRESS_TYPE.VERUS,
    addressPlaceholder: 'R-address, i-address, or VerusID',
    addressHint: 'Enter a Verus R-address, i-address, or VerusID (ending with @)',
  },
  // vETH (Ethereum bridge on Verus)
  'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X': {
    name: 'Ethereum',
    icon: 'ETH',
    addressType: ADDRESS_TYPE.ETHEREUM,
    addressPlaceholder: '0x... Ethereum address',
    addressHint: 'Enter a valid Ethereum address starting with 0x',
  },
};

// Currency display overrides - maps currency IDs to user-friendly names
// Used when fullyqualifiedname isn't user-friendly
export const CURRENCY_DISPLAY = {
  // vETH -> Ethereum
  'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X': {
    name: 'Ethereum',
    ticker: 'ETH',
  },
  // vUSDC.vETH -> USDC
  'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd': {
    name: 'USDC',
    ticker: 'USDC',
  },
  // DAI.vETH -> DAI
  'iGBs4DWztRNvNEJBt4mqHszLxfKTNHTkhM': {
    name: 'DAI',
    ticker: 'DAI',
  },
  // MKR.vETH -> MKR
  'iCkKJuJScy4Z6NSDK7Mt42ZAB2NEnAE1o4': {
    name: 'Maker',
    ticker: 'MKR',
  },
  // EURC.vETH -> EURC
  'iC5TQFrFXSYLQGkiZ8FYmZHFJzaRF5CYgE': {
    name: 'EURC',
    ticker: 'EURC',
  },
  // TBTC.vETH -> tBTC
  'iS8TfRPfVpKo5FVfSUzfHBQxo9KuzpnqLU': {
    name: 'tBTC',
    ticker: 'TBTC',
  },
  // Bridge.vETH
  'i3f7tSctFkiPpiedY8QR5Tep9p4qDVebDx': {
    name: 'Bridge.vETH',
    ticker: 'Bridge.vETH',
  },
  // Switch - liquidity pool currency
  'i4Xr5TAMrDTD99H69EemhjDxJ4ktNskUtc': {
    name: 'Switch',
    ticker: 'Switch',
  },
  // Pure - liquidity pool currency
  'iHax5qYQGbcMGqJKKrPorpzUBX2oFFXGnY': {
    name: 'Pure',
    ticker: 'Pure',
  },
  // Kaiju - liquidity pool currency
  'i9kVWKU2VwARALpbXn4RS9zvrhvNRaUibb': {
    name: 'Kaiju',
    ticker: 'Kaiju',
  },
  // VRSC
  'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV': {
    name: 'VRSC',
    ticker: 'VRSC',
  },
};

/**
 * Get user-friendly display name for a network/system
 * @param {string} systemId - The system/network currency ID
 * @param {string} fallback - Fallback name if not found
 * @returns {string} User-friendly network name
 */
export const getNetworkDisplayName = (systemId, fallback = null) => {
  // Handle .eth system ID (used by ETH/ERC20 coins) - display as Ethereum
  if (systemId === '.eth') {
    return 'Ethereum';
  }
  if (NETWORK_DISPLAY[systemId]) {
    return NETWORK_DISPLAY[systemId].name;
  }
  // Try to get from coinsList
  if (coinsList[systemId]) {
    return coinsList[systemId].display_name;
  }
  // Try CoinDirectory for pBaaS chains
  try {
    const { CoinDirectory } = require('../../utils/CoinData/CoinDirectory');
    const coinObj = CoinDirectory.findCoinObj(systemId);
    if (coinObj && coinObj.display_name) {
      return coinObj.display_name;
    }
  } catch (e) {
    // Not found in CoinDirectory
  }
  // If fallback provided, use it
  if (fallback) return fallback;
  // Don't return raw i-addresses - return null so caller can handle
  if (systemId && systemId.startsWith('i') && systemId.length > 30) {
    return null;
  }
  return systemId;
};

/**
 * Get icon ID for a network/system
 * @param {string} systemId - The system/network currency ID
 * @returns {string|null} Icon ID for RenderSquareCoinLogo
 */
export const getNetworkIcon = (systemId) => {
  // Handle .eth system ID (used by ETH/ERC20 coins) - map to ETH icon
  if (systemId === '.eth') {
    return 'ETH';
  }
  if (NETWORK_DISPLAY[systemId]) {
    return NETWORK_DISPLAY[systemId].icon;
  }
  // Try to get from coinsList - use the ID directly as the icon key
  if (coinsList[systemId] && coinsList[systemId].id) {
    return coinsList[systemId].id;
  }
  // Try CoinDirectory for pBaaS chains
  try {
    const { CoinDirectory } = require('../../utils/CoinData/CoinDirectory');
    const coinObj = CoinDirectory.findCoinObj(systemId);
    if (coinObj && coinObj.id) {
      return coinObj.id;
    }
  } catch (e) {
    // Not found in CoinDirectory
  }
  // Default to systemId itself - RenderSquareCoinLogo will use it to find the icon
  return systemId || 'VRSC';
};

/**
 * Get address type for a network/system
 * @param {string} systemId - The system/network currency ID
 * @returns {string} Address type (verus or ethereum)
 */
export const getNetworkAddressType = (systemId) => {
  if (NETWORK_DISPLAY[systemId]) {
    return NETWORK_DISPLAY[systemId].addressType;
  }
  // Default to Verus address type for unknown pBaaS chains
  return ADDRESS_TYPE.VERUS;
};

/**
 * Get address placeholder text for a network/system
 * @param {string} systemId - The system/network currency ID
 * @returns {string} Placeholder text for address input
 */
export const getAddressPlaceholder = (systemId) => {
  if (NETWORK_DISPLAY[systemId]) {
    return NETWORK_DISPLAY[systemId].addressPlaceholder;
  }
  return 'R-address, i-address, or VerusID';
};

/**
 * Get address hint text for a network/system
 * @param {string} systemId - The system/network currency ID
 * @returns {string} Hint text for address input
 */
export const getAddressHint = (systemId) => {
  if (NETWORK_DISPLAY[systemId]) {
    return NETWORK_DISPLAY[systemId].addressHint;
  }
  return 'Enter a Verus R-address, i-address, or VerusID (ending with @)';
};

/**
 * Get user-friendly display name for a currency
 * @param {string} currencyId - The currency ID
 * @param {string} fallback - Fallback name (e.g., fullyqualifiedname)
 * @returns {string} User-friendly currency name
 */
export const getCurrencyDisplayName = (currencyId, fallback = null) => {
  if (CURRENCY_DISPLAY[currencyId]) {
    return CURRENCY_DISPLAY[currencyId].name;
  }
  return fallback || currencyId;
};

/**
 * Get user-friendly ticker for a currency
 * @param {string} currencyId - The currency ID
 * @param {string} fallback - Fallback ticker
 * @returns {string} User-friendly ticker
 */
export const getCurrencyDisplayTicker = (currencyId, fallback = null) => {
  if (CURRENCY_DISPLAY[currencyId]) {
    return CURRENCY_DISPLAY[currencyId].ticker;
  }
  return fallback || currencyId;
};

/**
 * Determine the destination address type based on export destination and source coin protocol
 * 
 * Ethereum addresses are required when:
 * 1. Exporting TO Ethereum mainnet via the vETH bridge (exportTo = vETH system ID)
 * 2. Doing a normal on-chain ETH or ERC20 send (proto = 'eth' or 'erc20', exportTo = null)
 * 
 * In all other cases, including currencies that live ON the vETH system (like vUSDC.vETH),
 * Verus addresses are used because vETH is still a Verus pBaaS chain.
 * 
 * @param {string|null} exportTo - The export destination system ID (null = same network)
 * @param {string} sourceSystemId - The source currency's system ID
 * @param {string|null} sourceCoinProto - The source coin's protocol (eth, erc20, vrsc, etc.)
 * @returns {string} Address type for the destination
 */
export const getDestinationAddressType = (exportTo, sourceSystemId, sourceCoinProto = null) => {
  const VETH_SYSTEM_ID = 'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X';
  
  // Case 1: Exporting to Ethereum via the vETH bridge
  if (exportTo === VETH_SYSTEM_ID) {
    return ADDRESS_TYPE.ETHEREUM;
  }
  
  // Case 2: Normal on-chain ETH or ERC20 send (no exportTo means staying on Ethereum)
  if (!exportTo && (sourceCoinProto === 'eth' || sourceCoinProto === 'erc20')) {
    return ADDRESS_TYPE.ETHEREUM;
  }
  
  // All other cases use Verus addresses, including:
  // - Staying on same network (no exportTo) for Verus-based chains
  // - Currencies on vETH system (they still use Verus addresses)
  // - Cross-chain to other pBaaS chains
  // - ETH/ERC20 bridging to Verus (exportTo is set to a Verus system)
  return ADDRESS_TYPE.VERUS;
};

/**
 * Get the destination network name for display
 * @param {string|null} exportTo - The export destination system ID
 * @param {string} sourceSystemId - The source currency's system ID
 * @returns {string} Destination network display name
 */
export const getDestinationNetworkName = (exportTo, sourceSystemId) => {
  if (exportTo) {
    return getNetworkDisplayName(exportTo);
  }
  return getNetworkDisplayName(sourceSystemId);
};

// Mapping from currency IDs to their canonical asset symbol for grouping
// This maps different representations of the same asset to a single key
const CANONICAL_ASSET_MAP = {
  // DAI: Verus DAI.vETH and Ethereum DAI
  'iGBs4DWztRNvNEJBt4mqHszLxfKTNHTkhM': 'DAI',
  'DAI': 'DAI',
  // MKR: Verus MKR.vETH and Ethereum MKR
  'iCkKJuJScy4Z6NSDK7Mt42ZAB2NEnAE1o4': 'MKR',
  'MKR': 'MKR',
  // VRSC: Native VRSC and ERC20 VRSC
  'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV': 'VRSC',
  'VRSC': 'VRSC',
  '0xBc2738BA63882891094C99E59a02141Ca1A1C36a': 'VRSC',
  // USDC: Verus vUSDC.vETH and Ethereum USDC
  'i61cV2uicKSi1rSMQCBNQeSYC3UAi9GVzd': 'USDC',
  'USDC': 'USDC',
  // tBTC: Verus tBTC.vETH and Ethereum tBTC
  'iS8TfRPfVpKo5FVfSUzfHBQxo9KuzpnqLU': 'TBTC',
  '0x18084fbA666a33d37592fA2633fD49a74DD93a88': 'TBTC',
  // EURC: Verus EURC.vETH and Ethereum EURC
  'iC5TQFrFXSYLQGkiZ8FYmZHFJzaRF5CYgE': 'EURC',
  '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c': 'EURC',
  // ETH / vETH
  'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X': 'ETH',
  'ETH': 'ETH',
  // Bridge.vETH
  'i3f7tSctFkiPpiedY8QR5Tep9p4qDVebDx': 'BRIDGE',
  '0xE6052Dcc60573561ECef2D9A4C0FEA6d3aC5B9A2': 'BRIDGE',
};/**
 * Get the canonical asset key for grouping related currencies
 * This maps different representations of the same asset (e.g., DAI on Ethereum vs DAI.vETH on Verus)
 * to a single key so they can be grouped together in the UI.
 * 
 * @param {string} currencyId - The currency ID
 * @param {string} ticker - The display ticker (used as fallback)
 * @param {string} name - The display name (used for pattern matching)
 * @returns {string} Canonical asset key for grouping
 */
export const getCanonicalAssetKey = (currencyId, ticker = '', name = '') => {
  // Check explicit mapping first
  if (CANONICAL_ASSET_MAP[currencyId]) {
    return CANONICAL_ASSET_MAP[currencyId];
  }
  
  // Try to extract base ticker from patterns like "DAI.vETH" or "VRSC [ERC20]"
  const tickerUpper = (ticker || '').toUpperCase();
  
  // Pattern: "XXX.vETH" -> "XXX"
  if (tickerUpper.endsWith('.VETH')) {
    return tickerUpper.replace('.VETH', '');
  }
  
  // Pattern: "vXXX.vETH" -> "XXX" (e.g., vUSDC.vETH -> USDC)
  if (tickerUpper.startsWith('V') && tickerUpper.includes('.VETH')) {
    return tickerUpper.substring(1).replace('.VETH', '');
  }
  
  // Pattern: "XXX [ERC20]" -> "XXX"
  if (tickerUpper.includes('[ERC20]')) {
    return tickerUpper.replace(/\s*\[ERC20\]\s*/i, '').trim();
  }
  
  // Pattern: "XXX on Verus" or "XXX on Ethereum" -> "XXX"
  const nameUpper = (name || '').toUpperCase();
  const onVerusMatch = nameUpper.match(/^(.+?)\s+ON\s+VERUS$/i);
  if (onVerusMatch) {
    return onVerusMatch[1].trim().toUpperCase();
  }
  const onEthMatch = nameUpper.match(/^(.+?)\s+ON\s+ETHEREUM$/i);
  if (onEthMatch) {
    return onEthMatch[1].trim().toUpperCase();
  }
  
  // Default: use the ticker as-is (uppercase)
  return tickerUpper || currencyId;
};

/**
 * Get the display info for a canonical asset group
 * Returns a user-friendly name and ticker for grouped assets
 * 
 * @param {string} canonicalKey - The canonical asset key
 * @returns {{ name: string, ticker: string }} Display info for the group
 */
export const getCanonicalAssetDisplayInfo = (canonicalKey) => {
  const displayMap = {
    'DAI': { name: 'DAI', ticker: 'DAI' },
    'MKR': { name: 'Maker', ticker: 'MKR' },
    'VRSC': { name: 'Verus', ticker: 'VRSC' },
    'USDC': { name: 'USDC', ticker: 'USDC' },
    'TBTC': { name: 'tBTC', ticker: 'tBTC' },
    'EURC': { name: 'EURC', ticker: 'EURC' },
    'ETH': { name: 'Ethereum', ticker: 'ETH' },
    'BRIDGE': { name: 'Bridge.vETH', ticker: 'Bridge.vETH' },
  };
  
  return displayMap[canonicalKey] || { name: canonicalKey, ticker: canonicalKey };
};