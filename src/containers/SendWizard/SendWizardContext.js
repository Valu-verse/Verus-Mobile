/*
  SendWizardContext
  - React Context for managing wizard state across steps
  - Holds source asset, target currency, amount, routing, recipient, and preflight data
  - Created 2024-12-09
  - Updated 2024-12-09: Added destinationAddressType tracking for address validation
  - Updated 2025-12-11: Added initialParams support for pre-selecting source coin
*/

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { getDestinationAddressType, ADDRESS_TYPE } from './sendWizardDisplayInfo';

const initialState = {
  // Step 1: Source selection
  sourceCoin: null,         // coinObj
  sourceSubWallet: null,    // subwallet object
  sourceBalance: null,      // spendable balance in coins

  // Step 2: Target selection
  targetCurrency: null,     // currency id or coinObj for convertto
  exportTo: null,           // chain/network id for cross-chain
  isConversion: false,      // true if convertto differs from source
  isCrossChain: false,      // true if exportto is set
  mapTo: null,              // mapping field for bridge transfers
  destinationAddressType: ADDRESS_TYPE.VERUS, // address type for recipient validation

  // Step 3: Amount and routing
  amount: '',               // string input
  amountSats: null,         // satoshis as string
  via: null,                // routing currency for conversions
  viaOptions: [],           // available via options
  estimate: null,           // conversion estimate result
  preconvert: false,        // preconvert flag

  // Step 4: Recipient
  recipientAddress: '',     // address string
  recipientDestination: null, // TransferDestination object

  // Step 5: Preflight & Confirm
  preflightResult: null,    // result from preflight call
  channel: null,            // channel id used for transaction

  // General
  currentStep: 1,
  loading: false,
  error: null,
};

const ACTIONS = {
  SET_SOURCE: 'SET_SOURCE',
  SET_TARGET: 'SET_TARGET',
  SET_AMOUNT: 'SET_AMOUNT',
  SET_VIA: 'SET_VIA',
  SET_ESTIMATE: 'SET_ESTIMATE',
  SET_RECIPIENT: 'SET_RECIPIENT',
  SET_PREFLIGHT: 'SET_PREFLIGHT',
  SET_STEP: 'SET_STEP',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  RESET: 'RESET',
};

function wizardReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_SOURCE:
      return {
        ...state,
        sourceCoin: action.payload.coin,
        sourceSubWallet: action.payload.subWallet,
        sourceBalance: action.payload.balance,
        channel: action.payload.channel,
        // Reset dependent fields
        targetCurrency: null,
        exportTo: null,
        isConversion: false,
        isCrossChain: false,
        amount: '',
        amountSats: null,
        via: null,
        estimate: null,
        recipientAddress: '',
        recipientDestination: null,
        preflightResult: null,
      };

    case ACTIONS.SET_TARGET:
      // Compute destination address type based on exportTo and source system
      const sourceSystemId = state.sourceCoin?.system_id || state.sourceCoin?.id;
      const destAddressType = getDestinationAddressType(
        action.payload.exportTo,
        sourceSystemId
      );
      return {
        ...state,
        targetCurrency: action.payload.currency,
        exportTo: action.payload.exportTo,
        isConversion: action.payload.isConversion,
        isCrossChain: action.payload.isCrossChain,
        mapTo: action.payload.mapTo,
        viaOptions: action.payload.viaOptions || [],
        destinationAddressType: destAddressType,
        // Reset dependent fields
        amount: '',
        amountSats: null,
        via: null,
        estimate: null,
        recipientAddress: '',
        recipientDestination: null,
        preflightResult: null,
      };

    case ACTIONS.SET_AMOUNT:
      return {
        ...state,
        amount: action.payload.amount,
        amountSats: action.payload.amountSats,
      };

    case ACTIONS.SET_VIA:
      return {
        ...state,
        via: action.payload.via,
        viaOptions: action.payload.viaOptions ?? state.viaOptions,
        preconvert: action.payload.preconvert ?? state.preconvert,
      };

    case ACTIONS.SET_ESTIMATE:
      return {
        ...state,
        estimate: action.payload.estimate,
        viaOptions: action.payload.viaOptions ?? state.viaOptions,
        via: action.payload.via ?? state.via,
      };

    case ACTIONS.SET_RECIPIENT:
      return {
        ...state,
        recipientAddress: action.payload.address,
        recipientDestination: action.payload.destination,
      };

    case ACTIONS.SET_PREFLIGHT:
      return {
        ...state,
        preflightResult: action.payload.result,
      };

    case ACTIONS.SET_STEP:
      return {
        ...state,
        currentStep: action.payload.step,
      };

    case ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };

    case ACTIONS.RESET:
      return { ...initialState };

    default:
      return state;
  }
}

const SendWizardContext = createContext(null);

export const SendWizardProvider = ({ children, initialParams = {} }) => {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  
  // Memoize initial params to avoid unnecessary re-renders
  const memoizedInitialParams = useMemo(() => initialParams, [
    initialParams.initialCoinId,
    initialParams.initialSubWalletId,
  ]);

  const setSource = useCallback((coin, subWallet, balance, channel) => {
    dispatch({
      type: ACTIONS.SET_SOURCE,
      payload: { coin, subWallet, balance, channel },
    });
  }, []);

  const setTarget = useCallback((currency, exportTo, isConversion, isCrossChain, mapTo = null, viaOptions = []) => {
    dispatch({
      type: ACTIONS.SET_TARGET,
      payload: { currency, exportTo, isConversion, isCrossChain, mapTo, viaOptions },
    });
  }, []);

  const setAmount = useCallback((amount, amountSats) => {
    dispatch({
      type: ACTIONS.SET_AMOUNT,
      payload: { amount, amountSats },
    });
  }, []);

  const setVia = useCallback((via, viaOptions = null, preconvert = false) => {
    dispatch({
      type: ACTIONS.SET_VIA,
      payload: { via, viaOptions, preconvert },
    });
  }, []);

  const setEstimate = useCallback((estimate, viaOptions = null, via = null) => {
    dispatch({
      type: ACTIONS.SET_ESTIMATE,
      payload: { estimate, viaOptions, via },
    });
  }, []);

  const setRecipient = useCallback((address, destination) => {
    dispatch({
      type: ACTIONS.SET_RECIPIENT,
      payload: { address, destination },
    });
  }, []);

  const setPreflight = useCallback((result) => {
    dispatch({
      type: ACTIONS.SET_PREFLIGHT,
      payload: { result },
    });
  }, []);

  const setStep = useCallback((step) => {
    dispatch({
      type: ACTIONS.SET_STEP,
      payload: { step },
    });
  }, []);

  const setLoading = useCallback((loading) => {
    dispatch({
      type: ACTIONS.SET_LOADING,
      payload: loading,
    });
  }, []);

  const setError = useCallback((error) => {
    dispatch({
      type: ACTIONS.SET_ERROR,
      payload: error,
    });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: ACTIONS.RESET });
  }, []);

  const value = {
    state,
    initialParams: memoizedInitialParams,
    setSource,
    setTarget,
    setAmount,
    setVia,
    setEstimate,
    setRecipient,
    setPreflight,
    setStep,
    setLoading,
    setError,
    reset,
  };

  return (
    <SendWizardContext.Provider value={value}>
      {children}
    </SendWizardContext.Provider>
  );
};

export const useSendWizard = () => {
  const context = useContext(SendWizardContext);
  if (!context) {
    throw new Error('useSendWizard must be used within SendWizardProvider');
  }
  return context;
};

export default SendWizardContext;

