/*
  addressBook.js
  - Constants for address book feature
  - Defines address types and validation helpers
  - Created 2026-01-22
  - Updated 2026-01-22: Added support for Bitcoin, Litecoin, and other cryptocurrency
    address formats. Made validation more permissive to support the full range of
    coins available in the app.
*/

// Address type constants
export const ADDRESS_TYPE = {
  VERUS_R: 'VERUS_R',       // Verus R-address (starts with R)
  VERUS_I: 'VERUS_I',       // Verus i-address (starts with i)
  VERUS_ID: 'VERUS_ID',     // VerusID (ends with @)
  ETHEREUM: 'ETHEREUM',     // Ethereum address (starts with 0x)
  BITCOIN: 'BITCOIN',       // Bitcoin address (starts with 1, 3, or bc1)
  LITECOIN: 'LITECOIN',     // Litecoin address (starts with L, M, or ltc1)
  ZCASH: 'ZCASH',           // Zcash t-address (starts with t1 or t3)
  KOMODO: 'KOMODO',         // Komodo address (starts with R - same as Verus)
  OTHER_CRYPTO: 'OTHER_CRYPTO', // Other recognized crypto addresses
};

// Display labels for address types
export const ADDRESS_TYPE_LABELS = {
  [ADDRESS_TYPE.VERUS_R]: 'Verus R-Address',
  [ADDRESS_TYPE.VERUS_I]: 'Verus i-Address',
  [ADDRESS_TYPE.VERUS_ID]: 'VerusID',
  [ADDRESS_TYPE.ETHEREUM]: 'Ethereum',
  [ADDRESS_TYPE.BITCOIN]: 'Bitcoin',
  [ADDRESS_TYPE.LITECOIN]: 'Litecoin',
  [ADDRESS_TYPE.ZCASH]: 'Zcash',
  [ADDRESS_TYPE.KOMODO]: 'Komodo',
  [ADDRESS_TYPE.OTHER_CRYPTO]: 'Crypto Address',
};

// Short labels for badges
export const ADDRESS_TYPE_SHORT_LABELS = {
  [ADDRESS_TYPE.VERUS_R]: 'Verus',
  [ADDRESS_TYPE.VERUS_I]: 'Verus',
  [ADDRESS_TYPE.VERUS_ID]: 'VerusID',
  [ADDRESS_TYPE.ETHEREUM]: 'ETH',
  [ADDRESS_TYPE.BITCOIN]: 'BTC',
  [ADDRESS_TYPE.LITECOIN]: 'LTC',
  [ADDRESS_TYPE.ZCASH]: 'ZEC',
  [ADDRESS_TYPE.KOMODO]: 'KMD',
  [ADDRESS_TYPE.OTHER_CRYPTO]: 'Crypto',
};

// Group types (for filtering in UI)
export const ADDRESS_GROUP = {
  VERUS: 'VERUS',       // All Verus types (R, i, ID)
  ETHEREUM: 'ETHEREUM', // Ethereum addresses
  BITCOIN: 'BITCOIN',   // Bitcoin-like addresses (BTC, LTC, etc.)
  ALL: 'ALL',           // All types
};

/**
 * Check if string contains only valid base58 characters
 * @param {string} str - String to check
 * @returns {boolean} True if valid base58
 */
const isValidBase58 = (str) => {
  // Base58 alphabet (no 0, O, I, l)
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return base58Regex.test(str);
};

/**
 * Check if string contains only valid bech32 characters
 * @param {string} str - String to check
 * @returns {boolean} True if valid bech32
 */
const isValidBech32 = (str) => {
  // Bech32 uses lowercase alphanumeric except 1, b, i, o
  const bech32Regex = /^[a-z0-9]+$/;
  return bech32Regex.test(str.toLowerCase());
};

/**
 * Detect address type from address string
 * @param {string} address - The address to analyze
 * @returns {string|null} Address type constant or null if unknown
 */
export const detectAddressType = (address) => {
  if (!address || typeof address !== 'string') {
    return null;
  }
  
  const trimmed = address.trim();
  
  if (trimmed.length < 10) {
    return null; // Too short to be any valid address
  }
  
  // VerusID (ends with @)
  if (trimmed.endsWith('@')) {
    return ADDRESS_TYPE.VERUS_ID;
  }
  
  // Ethereum address (starts with 0x, 42 chars)
  if (trimmed.startsWith('0x') && trimmed.length === 42) {
    return ADDRESS_TYPE.ETHEREUM;
  }
  
  // Bitcoin Legacy P2PKH (starts with 1, 25-34 chars)
  if (trimmed.startsWith('1') && trimmed.length >= 25 && trimmed.length <= 34 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.BITCOIN;
  }
  
  // Bitcoin P2SH (starts with 3, 25-34 chars)
  if (trimmed.startsWith('3') && trimmed.length >= 25 && trimmed.length <= 34 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.BITCOIN;
  }
  
  // Bitcoin Native SegWit / Bech32 (starts with bc1)
  if (trimmed.toLowerCase().startsWith('bc1') && trimmed.length >= 42 && trimmed.length <= 62 && isValidBech32(trimmed)) {
    return ADDRESS_TYPE.BITCOIN;
  }
  
  // Litecoin Legacy (starts with L, 25-34 chars)
  if (trimmed.startsWith('L') && trimmed.length >= 25 && trimmed.length <= 34 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.LITECOIN;
  }
  
  // Litecoin P2SH (starts with M, 25-34 chars)
  if (trimmed.startsWith('M') && trimmed.length >= 25 && trimmed.length <= 34 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.LITECOIN;
  }
  
  // Litecoin Native SegWit / Bech32 (starts with ltc1)
  if (trimmed.toLowerCase().startsWith('ltc1') && trimmed.length >= 42 && trimmed.length <= 62 && isValidBech32(trimmed)) {
    return ADDRESS_TYPE.LITECOIN;
  }
  
  // Zcash t-address (starts with t1 or t3, 35 chars)
  if ((trimmed.startsWith('t1') || trimmed.startsWith('t3')) && trimmed.length >= 34 && trimmed.length <= 36 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.ZCASH;
  }
  
  // Verus/Komodo R-address (starts with R, 34 chars)
  // These are indistinguishable, default to Verus since this is a Verus app
  if (trimmed.startsWith('R') && trimmed.length >= 26 && trimmed.length <= 36 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.VERUS_R;
  }
  
  // Verus i-address (starts with i, 34 chars)
  if (trimmed.startsWith('i') && trimmed.length >= 26 && trimmed.length <= 36 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.VERUS_I;
  }
  
  // Dogecoin (starts with D, 34 chars) - treat as OTHER_CRYPTO
  if (trimmed.startsWith('D') && trimmed.length >= 25 && trimmed.length <= 36 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.OTHER_CRYPTO;
  }
  
  // Dash (starts with X, 34 chars) - treat as OTHER_CRYPTO
  if (trimmed.startsWith('X') && trimmed.length >= 25 && trimmed.length <= 36 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.OTHER_CRYPTO;
  }
  
  // DigiByte (starts with D or S, 34 chars) - treat as OTHER_CRYPTO
  if ((trimmed.startsWith('D') || trimmed.startsWith('S') || trimmed.startsWith('dgb1')) && 
      trimmed.length >= 25 && trimmed.length <= 62) {
    if (trimmed.toLowerCase().startsWith('dgb1') && isValidBech32(trimmed)) {
      return ADDRESS_TYPE.OTHER_CRYPTO;
    }
    if (isValidBase58(trimmed)) {
      return ADDRESS_TYPE.OTHER_CRYPTO;
    }
  }
  
  // Bitcoin Cash (starts with q or p for CashAddr, or 1/3 for legacy)
  if ((trimmed.startsWith('q') || trimmed.startsWith('p') || 
       trimmed.toLowerCase().startsWith('bitcoincash:')) && 
      trimmed.length >= 25 && trimmed.length <= 60) {
    return ADDRESS_TYPE.OTHER_CRYPTO;
  }
  
  // Generic base58 address detection for other coins
  // If it looks like a valid base58 address with reasonable length, accept it
  if (trimmed.length >= 25 && trimmed.length <= 50 && isValidBase58(trimmed)) {
    return ADDRESS_TYPE.OTHER_CRYPTO;
  }
  
  // Generic bech32 address detection (starts with common prefixes)
  const bech32Prefixes = ['bc1', 'ltc1', 'tb1', 'dgb1', 'vtc1', 'grs1'];
  for (const prefix of bech32Prefixes) {
    if (trimmed.toLowerCase().startsWith(prefix) && trimmed.length >= 40 && isValidBech32(trimmed)) {
      return ADDRESS_TYPE.OTHER_CRYPTO;
    }
  }
  
  return null;
};

/**
 * Get the group for an address type
 * @param {string} type - Address type constant
 * @returns {string} Address group constant
 */
export const getAddressGroup = (type) => {
  switch (type) {
    case ADDRESS_TYPE.VERUS_R:
    case ADDRESS_TYPE.VERUS_I:
    case ADDRESS_TYPE.VERUS_ID:
    case ADDRESS_TYPE.KOMODO:
      return ADDRESS_GROUP.VERUS;
    case ADDRESS_TYPE.ETHEREUM:
      return ADDRESS_GROUP.ETHEREUM;
    case ADDRESS_TYPE.BITCOIN:
    case ADDRESS_TYPE.LITECOIN:
    case ADDRESS_TYPE.ZCASH:
    case ADDRESS_TYPE.OTHER_CRYPTO:
      return ADDRESS_GROUP.BITCOIN;
    default:
      return ADDRESS_GROUP.ALL;
  }
};

/**
 * Check if an address type is compatible with a destination type
 * @param {string} addressType - The saved address type
 * @param {string} destinationType - The required destination type (from sendWizardDisplayInfo)
 * @returns {boolean} True if compatible
 */
export const isAddressTypeCompatible = (addressType, destinationType) => {
  // If destination requires Ethereum
  if (destinationType === 'ethereum' || destinationType === 'ETHEREUM') {
    return addressType === ADDRESS_TYPE.ETHEREUM;
  }
  
  // If destination requires Verus (default for Verus/pBaaS sends)
  if (destinationType === 'verus' || destinationType === 'VERUS') {
    return addressType === ADDRESS_TYPE.VERUS_R || 
           addressType === ADDRESS_TYPE.VERUS_I || 
           addressType === ADDRESS_TYPE.VERUS_ID ||
           addressType === ADDRESS_TYPE.KOMODO;
  }
  
  // If no specific destination type, show all addresses
  // This allows other coin addresses to be visible
  if (!destinationType) {
    return true;
  }
  
  // Unknown destination type - allow all
  return true;
};

/**
 * Check if an address looks valid (basic format check)
 * This is more permissive than detectAddressType - it just checks
 * if the string could reasonably be a cryptocurrency address
 * @param {string} address - The address to validate
 * @returns {boolean} True if the address looks valid
 */
export const isValidAddressFormat = (address) => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  const trimmed = address.trim();
  
  // Minimum length check
  if (trimmed.length < 10) {
    return false;
  }
  
  // VerusID
  if (trimmed.endsWith('@') && trimmed.length >= 2) {
    return true;
  }
  
  // Ethereum address
  if (trimmed.startsWith('0x') && trimmed.length === 42) {
    // Check it's valid hex after 0x
    return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  }
  
  // If we can detect a type, it's valid
  const detectedType = detectAddressType(trimmed);
  if (detectedType) {
    return true;
  }
  
  // Last resort: check if it's alphanumeric and reasonable length
  // This allows for coins we might not explicitly recognize
  if (trimmed.length >= 20 && trimmed.length <= 100) {
    // Allow alphanumeric plus common separators like : for CashAddr
    if (/^[a-zA-Z0-9:]+$/.test(trimmed)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Truncate address for display
 * @param {string} address - Full address
 * @param {number} startChars - Characters to show at start (default 8)
 * @param {number} endChars - Characters to show at end (default 6)
 * @returns {string} Truncated address
 */
export const truncateAddress = (address, startChars = 8, endChars = 6) => {
  if (!address) return '';
  if (address.length <= startChars + endChars + 3) return address;
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};
