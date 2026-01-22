/*
  addressBookStorage.js
  - Secure storage layer for address book data
  - Stores encrypted address book entries per user (by accountHash)
  - Uses SecureStorage for encryption/decryption
  - Created 2026-01-22
*/

import { ADDRESS_BOOK_STORAGE_INTERNAL_KEY } from '../../../env/index';
import { SecureStorage } from '../keychain/secureStore';

/**
 * Store all address book data (encrypted)
 * @param {Object} data - Address book data object keyed by accountHash
 * @returns {Promise<Object>} The stored data
 */
export const storeAddressBook = (data) => {
  if (typeof data !== 'object') {
    throw new Error(`Address book store function expected object, received ${typeof data}`);
  }

  return new Promise((resolve, reject) => {
    SecureStorage.setItem(ADDRESS_BOOK_STORAGE_INTERNAL_KEY, JSON.stringify(data))
      .then(() => {
        resolve(data);
      })
      .catch(err => reject(err));
  });
};

/**
 * Load all address book data (decrypted)
 * @returns {Promise<Object>} Address book data object keyed by accountHash
 */
export const loadAddressBook = () => {
  return new Promise((resolve, reject) => {
    SecureStorage.getItem(ADDRESS_BOOK_STORAGE_INTERNAL_KEY)
      .then(res => {
        if (!res) {
          resolve({});
        } else {
          const parsed = JSON.parse(res);
          resolve(parsed);
        }
      })
      .catch(err => reject(err));
  });
};

/**
 * Clear all address book data
 * @returns {Promise<void>}
 */
export const clearAllAddressBookData = () => {
  return new Promise((resolve, reject) => {
    SecureStorage.removeItem(ADDRESS_BOOK_STORAGE_INTERNAL_KEY)
      .then(() => {
        resolve();
      })
      .catch(err => reject(err));
  });
};

/**
 * Store address book data for a specific user
 * @param {Object} data - Address book data for the user
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object>} The stored user data
 */
export const storeAddressBookForUser = async (data, accountHash) => {
  const allAddressBookData = { ...(await loadAddressBook()) };
  allAddressBookData[accountHash] = data;
  return (await storeAddressBook(allAddressBookData))[accountHash];
};

/**
 * Delete address book data for a specific user
 * @param {string} accountHash - User's account hash
 * @returns {Promise<undefined>}
 */
export const deleteAddressBookForUser = async (accountHash) => {
  const allAddressBookData = { ...(await loadAddressBook()) };
  delete allAddressBookData[accountHash];
  await storeAddressBook(allAddressBookData);
  return undefined;
};

/**
 * Load address book data for a specific user
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object>} User's address book data with addresses array
 */
export const loadAddressBookForUser = async (accountHash) => {
  const allAddressBookData = await loadAddressBook();

  if (allAddressBookData[accountHash] == null) {
    return {
      addresses: [],
    };
  }
  
  return allAddressBookData[accountHash];
};

/**
 * Add a single address to a user's address book
 * @param {Object} addressEntry - The address entry to add
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object>} Updated user's address book data
 */
export const addAddressForUser = async (addressEntry, accountHash) => {
  const userData = await loadAddressBookForUser(accountHash);
  const addresses = userData.addresses || [];
  
  // Add the new entry with a generated ID if not provided
  const entryWithId = {
    ...addressEntry,
    id: addressEntry.id || `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    dateAdded: addressEntry.dateAdded || Date.now(),
  };
  
  addresses.push(entryWithId);
  
  const updatedData = { ...userData, addresses };
  await storeAddressBookForUser(updatedData, accountHash);
  
  return updatedData;
};

/**
 * Update an existing address in a user's address book
 * @param {string} addressId - The ID of the address to update
 * @param {Object} updates - Fields to update
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object>} Updated user's address book data
 */
export const updateAddressForUser = async (addressId, updates, accountHash) => {
  const userData = await loadAddressBookForUser(accountHash);
  const addresses = userData.addresses || [];
  
  const index = addresses.findIndex(a => a.id === addressId);
  if (index === -1) {
    throw new Error(`Address with ID ${addressId} not found`);
  }
  
  addresses[index] = { ...addresses[index], ...updates };
  
  const updatedData = { ...userData, addresses };
  await storeAddressBookForUser(updatedData, accountHash);
  
  return updatedData;
};

/**
 * Delete an address from a user's address book
 * @param {string} addressId - The ID of the address to delete
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object>} Updated user's address book data
 */
export const deleteAddressFromUser = async (addressId, accountHash) => {
  const userData = await loadAddressBookForUser(accountHash);
  const addresses = userData.addresses || [];
  
  const filteredAddresses = addresses.filter(a => a.id !== addressId);
  
  const updatedData = { ...userData, addresses: filteredAddresses };
  await storeAddressBookForUser(updatedData, accountHash);
  
  return updatedData;
};

/**
 * Check if an address already exists in a user's address book
 * @param {string} address - The address string to check
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object|null>} The existing entry or null
 */
export const findAddressInBook = async (address, accountHash) => {
  const userData = await loadAddressBookForUser(accountHash);
  const addresses = userData.addresses || [];
  
  // Normalize address comparison (case-insensitive for ETH addresses)
  const normalizedAddress = address.toLowerCase();
  return addresses.find(a => a.address.toLowerCase() === normalizedAddress) || null;
};
