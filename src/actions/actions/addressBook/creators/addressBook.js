/*
  addressBook action creators
  - Redux action creators for address book state
  - Created 2026-01-22
*/

import {
  SET_ADDRESS_BOOK_DATA,
  ADD_ADDRESS_BOOK_ENTRY,
  UPDATE_ADDRESS_BOOK_ENTRY,
  DELETE_ADDRESS_BOOK_ENTRY,
  CLEAR_ADDRESS_BOOK,
} from '../../../../utils/constants/storeType';

/**
 * Set all address book data
 * @param {Object} data - Address book data with addresses array
 */
export const setAddressBookData = (data = { addresses: [] }) => ({
  type: SET_ADDRESS_BOOK_DATA,
  payload: data,
});

/**
 * Add a new address entry
 * @param {Object} entry - Address entry to add
 */
export const addAddressBookEntry = (entry) => ({
  type: ADD_ADDRESS_BOOK_ENTRY,
  payload: entry,
});

/**
 * Update an existing address entry
 * @param {string} id - ID of the address to update
 * @param {Object} updates - Fields to update
 */
export const updateAddressBookEntry = (id, updates) => ({
  type: UPDATE_ADDRESS_BOOK_ENTRY,
  payload: { id, updates },
});

/**
 * Delete an address entry
 * @param {string} id - ID of the address to delete
 */
export const deleteAddressBookEntry = (id) => ({
  type: DELETE_ADDRESS_BOOK_ENTRY,
  payload: { id },
});

/**
 * Clear all address book data
 */
export const clearAddressBook = () => ({
  type: CLEAR_ADDRESS_BOOK,
});
