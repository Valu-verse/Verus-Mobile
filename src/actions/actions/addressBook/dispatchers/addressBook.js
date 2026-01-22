/*
  addressBook dispatchers
  - Async dispatchers for address book operations
  - Handles storage and Redux state synchronization
  - Created 2026-01-22
*/

import store from '../../../../store';
import {
  loadAddressBookForUser,
  addAddressForUser,
  updateAddressForUser,
  deleteAddressFromUser,
  findAddressInBook,
} from '../../../../utils/asyncStore/addressBookStorage';
import {
  setAddressBookData,
  addAddressBookEntry,
  updateAddressBookEntry,
  deleteAddressBookEntry,
  clearAddressBook,
} from '../creators/addressBook';
import { detectAddressType } from '../../../../utils/constants/addressBook';

/**
 * Initialize address book data for a user (called on login)
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object>} Address book data
 */
export const initAddressBookForUser = async (accountHash) => {
  try {
    const data = await loadAddressBookForUser(accountHash);
    store.dispatch(setAddressBookData(data));
    return data;
  } catch (e) {
    console.warn('Failed to load address book:', e);
    store.dispatch(setAddressBookData({ addresses: [] }));
    return { addresses: [] };
  }
};

/**
 * Save a new address to the address book
 * @param {Object} addressData - Address data to save
 * @param {string} addressData.address - The address string
 * @param {string} addressData.label - User-provided label
 * @param {string} [addressData.type] - Address type (auto-detected if not provided)
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object>} The saved entry
 */
export const saveAddressToBook = async (addressData, accountHash) => {
  const { address, label, type } = addressData;
  
  if (!address || !label) {
    throw new Error('Address and label are required');
  }
  
  // Auto-detect type if not provided
  const detectedType = type || detectAddressType(address);
  
  const entry = {
    address: address.trim(),
    label: label.trim(),
    type: detectedType,
    dateAdded: Date.now(),
    lastUsed: null,
  };
  
  const updatedData = await addAddressForUser(entry, accountHash);
  
  // Get the newly added entry (last in array)
  const newEntry = updatedData.addresses[updatedData.addresses.length - 1];
  store.dispatch(addAddressBookEntry(newEntry));
  
  return newEntry;
};

/**
 * Update an existing address in the address book
 * @param {string} addressId - ID of the address to update
 * @param {Object} updates - Fields to update
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object>} Updated data
 */
export const updateAddressInBook = async (addressId, updates, accountHash) => {
  await updateAddressForUser(addressId, updates, accountHash);
  store.dispatch(updateAddressBookEntry(addressId, updates));
  return updates;
};

/**
 * Delete an address from the address book
 * @param {string} addressId - ID of the address to delete
 * @param {string} accountHash - User's account hash
 * @returns {Promise<void>}
 */
export const deleteAddressFromBook = async (addressId, accountHash) => {
  await deleteAddressFromUser(addressId, accountHash);
  store.dispatch(deleteAddressBookEntry(addressId));
};

/**
 * Update the lastUsed timestamp for an address
 * @param {string} addressId - ID of the address
 * @param {string} accountHash - User's account hash
 * @returns {Promise<void>}
 */
export const markAddressAsUsed = async (addressId, accountHash) => {
  const updates = { lastUsed: Date.now() };
  await updateAddressForUser(addressId, updates, accountHash);
  store.dispatch(updateAddressBookEntry(addressId, updates));
};

/**
 * Check if an address already exists in the book
 * @param {string} address - Address to check
 * @param {string} accountHash - User's account hash
 * @returns {Promise<Object|null>} Existing entry or null
 */
export const checkAddressExists = async (address, accountHash) => {
  return findAddressInBook(address, accountHash);
};

/**
 * Clear address book state (called on sign out)
 */
export const clearAddressBookState = () => {
  store.dispatch(clearAddressBook());
};
