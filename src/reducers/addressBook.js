/*
  addressBook.js
  - Redux reducer for address book state
  - Stores saved addresses for the active user
  - Created 2026-01-22
*/

import {
  SET_ADDRESS_BOOK_DATA,
  ADD_ADDRESS_BOOK_ENTRY,
  UPDATE_ADDRESS_BOOK_ENTRY,
  DELETE_ADDRESS_BOOK_ENTRY,
  CLEAR_ADDRESS_BOOK,
  SIGN_OUT,
} from '../utils/constants/storeType';

const initialState = {
  addresses: [],
  loading: false,
  error: null,
};

export const addressBook = (state = initialState, action) => {
  switch (action.type) {
    case SET_ADDRESS_BOOK_DATA:
      return {
        ...state,
        addresses: action.payload.addresses || [],
        loading: false,
        error: null,
      };

    case ADD_ADDRESS_BOOK_ENTRY:
      return {
        ...state,
        addresses: [...state.addresses, action.payload],
      };

    case UPDATE_ADDRESS_BOOK_ENTRY:
      return {
        ...state,
        addresses: state.addresses.map((addr) =>
          addr.id === action.payload.id
            ? { ...addr, ...action.payload.updates }
            : addr
        ),
      };

    case DELETE_ADDRESS_BOOK_ENTRY:
      return {
        ...state,
        addresses: state.addresses.filter((addr) => addr.id !== action.payload.id),
      };

    case CLEAR_ADDRESS_BOOK:
    case SIGN_OUT:
      return initialState;

    default:
      return state;
  }
};
