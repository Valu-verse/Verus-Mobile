/*
  SendWizardAmount
  - Step 3: Enter amount and select routing (via) for conversions
  - Shows conversion estimate when applicable
  - Allows manual via override via sheet
  - Created 2024-12-09
  - Updated 2024-12-09: Fetches estimates for ALL via options when amount is entered,
    auto-selects best route (highest output), passes estimates to via sheet
  - Updated 2024-12-10: Redesigned with GradientButton, auto-focus input, 
    compact estimate with rate, improved subtitle with chain info
  - Updated 2024-12-17: Fixed decimal separator issue - automatically converts commas to dots
    to support locale-specific keyboards (iOS shows comma in some regions)
  - Updated 2024-12-17: Fixed chain label for ETH/ERC20 - now correctly shows "Ethereum"
    or "Ethereum Testnet" instead of falling back to "Verus". Also caps MAX to 8 decimals
    for ETH/ERC20 and routes estimateConversion to correct VRPC system for bridge flows.
  - Updated 2024-12-23: For ETH/ERC20 sources, use precomputed path.price from viaOptions
    instead of calling estimateConversion API. This fixes "Could not estimate conversion"
    errors for bounceback paths where the API doesn't accept ETH contract addresses.
  - Updated 2024-12-23: Added support for isBounceback and ethDisplayInfo from context
    to properly display ETH token names (e.g., "DAI") instead of Verus names ("DAI.vETH")
    for bounceback paths. Also fixed destination chain display for ETH→vETH to show "Verus".
  - Updated 2026-01-06: Added price-based fallback estimates for non-ETH conversions when
    estimateConversion cannot estimate (e.g., some cross-chain-only bridge currencies).
    Prevents showing the "Can only estimate preconversions..." error when a path.price
    based estimate is available.
  - Updated 2026-01-07: Tweaked conversion subtitle wording for cross-chain conversions
    to use "on {network}" instead of "to {network}" for clarity.
  - Updated 2026-01-07: Added fiat display (input + output estimate when possible) and
    a fiat↔crypto entry toggle (persists in wizard state). Removed the redundant "Enter amount"
    title and refreshed layout with a modern amount "hero" card.
  - Updated 2026-01-07: Tightened vertical spacing, removed the divider above Available/MAX,
    simplified the conversion info to always show the rate (no collapsible details), and
    compacted the conversion card spacing.
  - Updated 2026-01-07: Renamed "Route" to "Conversion route" and replaced the estimate
    loading spinner/text with skeleton placeholders to prevent layout jitter while recalculating.
  - Updated 2026-01-09: Rate display now truncates to 8 decimals and trims trailing zeros
    (for the main conversion "Rate" line). Very small values show as 0.
  - Updated 2026-01-09: Pass target fullyqualifiedname (FQN) into the conversion route sheet
    for clearer labeling.
  - Updated 2026-01-09: Removed redundant over-balance helper text and kept the MAX button
    styling consistent (no error color) when amount exceeds balance.
  - Updated 2026-01-15: Added a header close X to exit the send flow.
  - Updated 2026-02-08: Use target FQN for receive/rate labels on amount screen.
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput as RNTextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatCurrency } from 'react-native-format-currency';
import { useSelector } from 'react-redux';
import Colors from '../../globals/colors';
import BigNumber from 'bignumber.js';
import { useSendWizard } from './SendWizardContext';
import { estimateConversion } from '../../utils/api/channels/vrpc/requests/estimateConversion';
import { coinsToSats } from '../../utils/math';
import SendViaSheet from './components/SendViaSheet';
import { RenderSquareCoinLogo } from '../../utils/CoinData/Graphics';
import { CoinDirectory } from '../../utils/CoinData/CoinDirectory';
import GradientButton from '../../components/GradientButton';
import { getNetworkDisplayName } from './sendWizardDisplayInfo';
import { getWeb3ProviderForNetwork } from '../../utils/web3/provider';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import { GENERAL, WYRE_SERVICE } from '../../utils/constants/intervalConstants';
import { USD } from '../../utils/constants/currencies';

const trimTrailingZeros = (valueStr) => {
  if (typeof valueStr !== 'string') return valueStr;
  // Remove trailing zeros in decimals, then remove a trailing '.' if present.
  return valueStr.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '').replace(/\.$/, '');
};

const formatTruncatedRate = (rateBnOrValue, decimals = 8) => {
  try {
    const bn = BigNumber(rateBnOrValue);
    if (!bn.isFinite() || bn.isNaN()) return null;

    const truncated = bn.decimalPlaces(decimals, BigNumber.ROUND_DOWN);
    const fixed = truncated.toFixed(decimals); // avoid scientific notation
    const trimmed = trimTrailingZeros(fixed);

    // Normalise "-0" edge cases to "0"
    return trimmed === '-0' ? '0' : trimmed;
  } catch (e) {
    return null;
  }
};

const getPriceBasedEstimate = (amountBn, price) => {
  if (!amountBn || amountBn.isNaN() || amountBn.isLessThanOrEqualTo(0)) return null;
  if (price == null) return null;
  const priceBn = BigNumber(price);
  if (priceBn.isNaN() || priceBn.isLessThanOrEqualTo(0)) return null;
  const out = amountBn.multipliedBy(priceBn);
  return {
    estimate: {
      estimatedcurrencyout: out.toString(),
      precomputed: true,
      price: priceBn.toString(),
    },
    output: out.toString(),
  };
};

const SendWizardAmount = () => {
  const navigation = useNavigation();
  const { state, setAmount, setVia, setEstimate, setStep } = useSendWizard();
  const {
    sourceCoin,
    amount: storedAmount,
    amountInputValue: storedAmountInputValue,
    amountFiat: storedAmountFiat,
    sourceBalance,
    targetCurrency,
    exportTo,
    isConversion,
    isCrossChain,
    via,
    viaOptions,
    estimate,
    isBounceback,
    ethDisplayInfo,
    targetDisplayName,
    targetDisplayTicker,
    convertToFqn,
  } = state;

  const inputRef = useRef(null);
  const [amountFiat, setAmountFiat] = useState(Boolean(storedAmountFiat));
  // Canonical crypto amount (single source of truth for sats/estimates/MAX). Display/edit can be fiat or crypto.
  const [cryptoAmountValue, setCryptoAmountValue] = useState(() => {
    if (storedAmount && String(storedAmount).trim() !== '') return String(storedAmount);
    return '';
  });
  const [inputValue, setInputValue] = useState(() => {
    if (storedAmountInputValue && String(storedAmountInputValue).trim() !== '') return String(storedAmountInputValue);
    if (!storedAmountFiat && storedAmount && String(storedAmount).trim() !== '') return String(storedAmount);
    return '';
  });
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(null);
  const [viaSheetVisible, setViaSheetVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  // Store estimates for all via options to display in sheet and auto-select best
  const [viaEstimates, setViaEstimates] = useState({});

  const handleClose = useCallback(() => {
    const parent = navigation.getParent?.();
    if (parent && typeof parent.goBack === 'function') {
      parent.goBack();
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const renderCloseButton = useCallback(() => (
    <TouchableOpacity
      onPress={handleClose}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.headerCloseButton}
    >
      <MaterialCommunityIcons name="close" size={22} color={Colors.verusDarkGray} />
    </TouchableOpacity>
  ), [handleClose]);

  // Auto-focus the input when screen mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: renderCloseButton,
      headerBackTitle: 'Back',
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: 'white',
        elevation: 0,
        shadowOpacity: 0,
      },
    });
  }, [navigation, renderCloseButton]);

  const displayCurrency = useSelector(
    (s) => s.settings.generalWalletSettings.displayCurrency || USD,
  );
  const rates = useObjectSelector((s) => s.ledger.rates);

  const getRate = useCallback(
    (coinId) => {
      if (!coinId) return null;
      return rates?.[WYRE_SERVICE]?.[coinId]?.[displayCurrency] != null
        ? rates[WYRE_SERVICE][coinId][displayCurrency]
        : rates?.[GENERAL]?.[coinId]?.[displayCurrency] != null
          ? rates[GENERAL][coinId][displayCurrency]
          : null;
    },
    [rates, displayCurrency],
  );

  const sourceRateBn = useMemo(() => {
    const r = sourceCoin?.id ? getRate(sourceCoin.id) : null;
    if (r == null) return null;
    try {
      const bn = BigNumber(r);
      if (bn.isNaN() || !bn.isFinite() || bn.isLessThanOrEqualTo(0)) return null;
      return bn;
    } catch (e) {
      return null;
    }
  }, [getRate, sourceCoin]);

  const fiatSymbol = useMemo(() => {
    try {
      const [formatted] = formatCurrency({ amount: '0', code: displayCurrency });
      const symbol = String(formatted).replace(/[0-9\s.,-]/g, '');
      return symbol || displayCurrency;
    } catch (e) {
      return displayCurrency;
    }
  }, [displayCurrency]);

  const formatFiat = useCallback(
    (fiatBn) => {
      if (!fiatBn || fiatBn.isNaN() || !fiatBn.isFinite()) return null;
      const rounded = fiatBn.decimalPlaces(2, BigNumber.ROUND_HALF_UP);
      const [formatted] = formatCurrency({ amount: rounded.toFixed(2), code: displayCurrency });
      return formatted;
    },
    [displayCurrency],
  );

  // Parse the raw input value (either crypto or fiat depending on amountFiat)
  const cryptoAmountBnForSats = useMemo(() => {
    if (!cryptoAmountValue || String(cryptoAmountValue).trim() === '') return null;
    try {
      const bn = BigNumber(cryptoAmountValue).decimalPlaces(8, BigNumber.ROUND_DOWN);
      if (bn.isNaN() || bn.isLessThanOrEqualTo(0)) return null;
      return bn;
    } catch (e) {
      return null;
    }
  }, [cryptoAmountValue]);

  const amountSats = useMemo(() => {
    if (!cryptoAmountBnForSats) return null;
    return coinsToSats(cryptoAmountBnForSats).toString();
  }, [cryptoAmountBnForSats]);

  const balanceBn = useMemo(() => {
    if (sourceBalance == null) return BigNumber(0);
    return BigNumber(sourceBalance);
  }, [sourceBalance]);

  const isOverBalance = useMemo(() => {
    if (!cryptoAmountBnForSats) return false;
    return cryptoAmountBnForSats.isGreaterThan(balanceBn);
  }, [cryptoAmountBnForSats, balanceBn]);

  const isValidAmount = useMemo(() => {
    return cryptoAmountBnForSats != null && !isOverBalance;
  }, [cryptoAmountBnForSats, isOverBalance]);

  // Check if source is ETH/ERC20 - these use precomputed prices instead of API calls
  const isEthSource = useMemo(() => {
    const proto = sourceCoin?.proto;
    return proto === 'eth' || proto === 'erc20';
  }, [sourceCoin]);

  // Fetch estimates for ALL via options when amount changes
  // Then auto-select the best one (highest output)
  // For ETH/ERC20 sources, use precomputed path.price instead of API calls
  // For direct conversions (no via needed), fetch estimate without via
  useEffect(() => {
    const fetchAllEstimates = async () => {
      if (!isConversion || !cryptoAmountBnForSats || !targetCurrency || !sourceCoin) {
        setEstimate(null);
        setViaEstimates({});
        return;
      }

      setEstimateLoading(true);
      setEstimateError(null);

      const amount = cryptoAmountBnForSats.toNumber();

      // Filter to get valid via options (exclude 'direct')
      const validViaOptions = (viaOptions || []).filter(
        opt => opt.id && opt.id !== 'direct' && !opt.isDirect
      );

      // For ETH/ERC20 sources, use precomputed prices from viaOptions
      // These were calculated by getConversionPaths and stored in path.price
      if (isEthSource) {
        const newEstimates = {};
        let bestVia = null;
        let bestOutput = BigNumber(0);

        // Process all via options with prices (including direct options for comparison)
        const allOptions = viaOptions || [];
        
        // First, check non-direct via options
        for (const opt of validViaOptions) {
          if (opt.price && opt.price > 0) {
            // Calculate estimated output using precomputed price
            // price = output/input, so output = input * price
            const estimatedOutput = cryptoAmountBnForSats.multipliedBy(opt.price);
            
            newEstimates[opt.id] = {
              estimate: {
                estimatedcurrencyout: estimatedOutput.toString(),
                precomputed: true, // Flag to indicate this is from path.price
              },
              output: estimatedOutput.toString(),
            };
            
            if (estimatedOutput.isGreaterThan(bestOutput)) {
              bestOutput = estimatedOutput;
              bestVia = opt.id;
            }
          }
        }
        
        // Also check for direct options (which might be the only option)
        const directOption = allOptions.find(opt => opt.isDirect && opt.price && opt.price > 0);
        if (directOption) {
          const estimatedOutput = cryptoAmountBnForSats.multipliedBy(directOption.price);
          
          // If direct is better than any via, use it
          if (estimatedOutput.isGreaterThan(bestOutput)) {
            setEstimate({
              estimatedcurrencyout: estimatedOutput.toString(),
              precomputed: true,
            });
            setVia(null);
            setViaEstimates(newEstimates);
            setEstimateLoading(false);
            return;
          }
        }

        setViaEstimates(newEstimates);

        if (bestVia && newEstimates[bestVia]?.estimate) {
          setVia(bestVia);
          setEstimate(newEstimates[bestVia].estimate);
        } else if (directOption) {
          // Fall back to direct option if no via was better
          const estimatedOutput = cryptoAmountBnForSats.multipliedBy(directOption.price);
          setEstimate({
            estimatedcurrencyout: estimatedOutput.toString(),
            precomputed: true,
          });
          setVia(null);
        } else {
          setEstimateError('Could not estimate conversion');
        }

        setEstimateLoading(false);
        return;
      }

      // For non-ETH sources, use the estimateConversion API
      const systemId = sourceCoin.system_id || sourceCoin.id;
      const currency = sourceCoin.currency_id || sourceCoin.id;

      // If no via options, this is a direct conversion - fetch estimate without via
      if (validViaOptions.length === 0) {
        try {
          const result = await estimateConversion(
            systemId,
            currency,
            targetCurrency,
            amount,
            null, // no via for direct conversion
            false
          );

          if (result.error) {
            // Fallback: use direct path.price if available (matches legacy send modal behavior)
            const directOpt = (viaOptions || []).find(opt => opt?.isDirect || opt?.id === 'direct');
            const fallback = directOpt ? getPriceBasedEstimate(cryptoAmountBnForSats, directOpt.price) : null;
            if (fallback?.estimate) {
              setEstimate(fallback.estimate);
              setVia(null);
              setViaEstimates(directOpt?.id ? { [directOpt.id]: fallback } : {});
              setEstimateError(null);
            } else {
              setEstimateError(result.error.message || 'Estimate failed');
              setEstimate(null);
            }
          } else if (result.result) {
            setEstimate(result.result);
            setVia(null); // Direct conversion, no via
          }
        } catch (e) {
          // Fallback: use direct path.price if available
          const directOpt = (viaOptions || []).find(opt => opt?.isDirect || opt?.id === 'direct');
          const fallback = directOpt ? getPriceBasedEstimate(cryptoAmountBnForSats, directOpt.price) : null;
          if (fallback?.estimate) {
            setEstimate(fallback.estimate);
            setVia(null);
            setViaEstimates(directOpt?.id ? { [directOpt.id]: fallback } : {});
            setEstimateError(null);
          } else {
            console.warn('Direct estimate error:', e);
            setEstimateError(e.message || 'Failed to get estimate');
          }
        }
        setEstimateLoading(false);
        return;
      }

      // Fetch estimates for all via options in parallel
      const estimatePromises = validViaOptions.map(async (opt) => {
        try {
          const result = await estimateConversion(
            systemId,
            currency,
            targetCurrency,
            amount,
            opt.id,
            false // preconvert
          );
          return { viaId: opt.id, result };
        } catch (e) {
          console.warn(`Estimate error for ${opt.id}:`, e);
          return { viaId: opt.id, error: e.message };
        }
      });

      try {
        const results = await Promise.all(estimatePromises);
        
        // Build estimates map and find best option
        const newEstimates = {};
        let bestVia = null;
        let bestOutput = BigNumber(0);

        for (const { viaId, result, error } of results) {
          if (error || result?.error) {
            newEstimates[viaId] = { error: error || result?.error?.message };
          } else if (result?.result) {
            const output = BigNumber(result.result.estimatedcurrencyout || 0);
            newEstimates[viaId] = {
              estimate: result.result,
              output: output.toString(),
            };
            
            // Track best option
            if (output.isGreaterThan(bestOutput)) {
              bestOutput = output;
              bestVia = viaId;
            }
          }
        }

        setViaEstimates(newEstimates);

        // Auto-select best via and set its estimate
        if (bestVia && newEstimates[bestVia]?.estimate) {
          setVia(bestVia);
          setEstimate(newEstimates[bestVia].estimate);
        } else {
          // No successful estimates from via options, try direct
          try {
            const directResult = await estimateConversion(
              systemId,
              currency,
              targetCurrency,
              amount,
              null,
              false
            );
            if (directResult.result) {
              setEstimate(directResult.result);
              setVia(null);
            } else {
              throw new Error(directResult?.error?.message || 'Could not estimate conversion');
            }
          } catch (e) {
            // Fallback: use path.price from viaOptions (legacy-style estimate)
            const fallbackEstimates = {};
            let bestFallbackVia = null;
            let bestFallbackOutput = BigNumber(0);

            // Include non-direct options
            for (const opt of validViaOptions) {
              const fallback = getPriceBasedEstimate(cryptoAmountBnForSats, opt.price);
              if (fallback) {
                fallbackEstimates[opt.id] = fallback;
                const out = BigNumber(fallback.output || 0);
                if (out.isGreaterThan(bestFallbackOutput)) {
                  bestFallbackOutput = out;
                  bestFallbackVia = opt.id;
                }
              }
            }

            // Include direct option (if present)
            const directOpt = (viaOptions || []).find(opt => opt?.isDirect || opt?.id === 'direct');
            const directFallback = directOpt ? getPriceBasedEstimate(cryptoAmountBnForSats, directOpt.price) : null;
            if (directOpt && directFallback) {
              fallbackEstimates[directOpt.id] = directFallback;
              const out = BigNumber(directFallback.output || 0);
              if (out.isGreaterThan(bestFallbackOutput)) {
                bestFallbackOutput = out;
                bestFallbackVia = null; // direct route
              }
            }

            const hasFallback = Object.keys(fallbackEstimates).length > 0 && bestFallbackOutput.isGreaterThan(0);
            if (hasFallback) {
              setViaEstimates(fallbackEstimates);
              if (bestFallbackVia) {
                setVia(bestFallbackVia);
                setEstimate(fallbackEstimates[bestFallbackVia].estimate);
              } else if (directFallback?.estimate) {
                setVia(null);
                setEstimate(directFallback.estimate);
              }
              setEstimateError(null);
            } else {
              setEstimateError(e.message || 'Could not estimate conversion for any route');
            }
          }
        }
      } catch (e) {
        console.warn('Error fetching estimates:', e);
        setEstimateError('Failed to get conversion estimates');
      }

      setEstimateLoading(false);
    };

    // Debounce the estimate calls
    const timer = setTimeout(fetchAllEstimates, 500);
    return () => clearTimeout(timer);
  }, [cryptoAmountBnForSats, targetCurrency, viaOptions, isConversion, sourceCoin, isEthSource, setVia, setEstimate]);

  // Update estimate when user manually changes via selection
  useEffect(() => {
    if (via && viaEstimates[via]?.estimate) {
      setEstimate(viaEstimates[via].estimate);
    }
  }, [via, viaEstimates, setEstimate]);

  const handleMaxPress = useCallback(() => {
    if (balanceBn.isGreaterThan(0)) {
      // MAX is always based on the crypto balance (even when displaying fiat)
      const sourceProto = sourceCoin?.proto;
      let maxCrypto;
      if (sourceProto === 'eth' || sourceProto === 'erc20') {
        maxCrypto = balanceBn.decimalPlaces(8, BigNumber.ROUND_DOWN).toString();
      } else {
        maxCrypto = balanceBn.toString();
      }

      setCryptoAmountValue(maxCrypto);

      if (amountFiat) {
        if (!sourceRateBn) return;
        const fiat = BigNumber(maxCrypto).multipliedBy(sourceRateBn).decimalPlaces(2, BigNumber.ROUND_DOWN);
        setInputValue(fiat.toString());
      } else {
        setInputValue(maxCrypto);
      }
    }
  }, [balanceBn, sourceCoin, amountFiat, sourceRateBn]);

  // Handle input change and normalize comma to dot for decimal separator
  const handleInputChange = useCallback((text) => {
    // Replace comma with dot to support locale-specific keyboards
    const normalizedText = text.replace(/,/g, '.');
    setInputValue(normalizedText);

    // Update canonical crypto amount based on the active input mode.
    // IMPORTANT: The canonical amount should only change on user edits, not on mode toggles,
    // to avoid precision loss when switching between fiat and crypto.
    if (!normalizedText || normalizedText.trim() === '') {
      setCryptoAmountValue('');
      return;
    }

    try {
      const inputBn = BigNumber(normalizedText);
      if (inputBn.isNaN() || !inputBn.isFinite() || inputBn.isLessThanOrEqualTo(0)) {
        setCryptoAmountValue('');
        return;
      }

      if (amountFiat) {
        if (!sourceRateBn) {
          setCryptoAmountValue('');
          return;
        }
        const crypto = inputBn.dividedBy(sourceRateBn).decimalPlaces(8, BigNumber.ROUND_DOWN);
        setCryptoAmountValue(crypto.toString());
      } else {
        const crypto = inputBn.decimalPlaces(8, BigNumber.ROUND_DOWN);
        setCryptoAmountValue(crypto.toString());
      }
    } catch (e) {
      setCryptoAmountValue('');
    }
  }, [amountFiat, sourceRateBn]);

  const handleToggleAmountMode = useCallback(() => {
    const nextFiat = !amountFiat;

    // Switching to fiat requires a rate to render a meaningful editable value.
    if (nextFiat && !sourceRateBn) return;

    // Do NOT mutate canonical crypto amount when toggling. Only update the displayed input value.
    if (!cryptoAmountBnForSats) {
      setAmountFiat(nextFiat);
      return;
    }

    if (nextFiat) {
      const fiat = cryptoAmountBnForSats.multipliedBy(sourceRateBn).decimalPlaces(2, BigNumber.ROUND_DOWN);
      setInputValue(fiat.toString());
    } else {
      setInputValue(cryptoAmountBnForSats.toString());
    }

    setAmountFiat(nextFiat);
  }, [amountFiat, sourceRateBn, cryptoAmountBnForSats]);

  const handleContinue = useCallback(() => {
    if (!isValidAmount) return;

    setAmount(cryptoAmountBnForSats.toString(), amountSats, inputValue, amountFiat);
    setStep(4);
    navigation.navigate('SendWizardRecipient');
  }, [isValidAmount, cryptoAmountBnForSats, amountSats, inputValue, amountFiat, setAmount, setStep, navigation]);

  const handleViaSelect = useCallback(
    (selectedVia) => {
      setVia(selectedVia);
      setViaSheetVisible(false);
    },
    [setVia],
  );

  // Get target currency display info
  // For bounceback paths, use the ETH token display info (e.g., "DAI" not "DAI.vETH")
  const targetCurrencyInfo = useMemo(() => {
    if (!targetCurrency) return { name: 'Unknown', ticker: '?' };
    
    // For bounceback paths, prefer the ETH display info
    if (isBounceback && ethDisplayInfo) {
      // Try to find the coin by contract address for icon
      let iconId = ethDisplayInfo.contractAddress;
      try {
        const coin = CoinDirectory.findCoinObj(ethDisplayInfo.contractAddress);
        if (coin) iconId = coin.id;
      } catch (e) {}
      
      return {
        name: ethDisplayInfo.name || ethDisplayInfo.ticker || 'Unknown',
        ticker: ethDisplayInfo.ticker || ethDisplayInfo.name || '?',
        coinId: iconId,
        isBounceback: true,
      };
    }
    
    let coin = null;
    try {
      coin = CoinDirectory.findCoinObj(targetCurrency);
    } catch (e) {}

    // Prefer the display labels captured from conversion paths (never show raw i-addresses)
    const name = targetDisplayName || coin?.display_name || targetCurrency;
    const ticker = targetDisplayTicker || coin?.display_ticker || targetCurrency;
    const coinId = coin?.id || null;

    return { name, ticker, coinId };
  }, [targetCurrency, isBounceback, ethDisplayInfo, targetDisplayName, targetDisplayTicker]);

  const targetReceiveLabel = useMemo(() => {
    if (convertToFqn && String(convertToFqn).trim() !== '') return convertToFqn;
    return targetCurrencyInfo?.ticker || '';
  }, [convertToFqn, targetCurrencyInfo]);

  // Get source and destination chain names for subtitle
  // Handles native ETH/ERC20 coins and Verus-based chains separately
  const chainInfo = useMemo(() => {
    const VETH_SYSTEM_ID = 'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X';
    const sourceSystemId = sourceCoin?.system_id || sourceCoin?.id;
    const sourceProto = sourceCoin?.proto;
    const isEthSource = sourceProto === 'eth' || sourceProto === 'erc20';
    
    // For native ETH/ERC20 coins (proto = 'eth' or 'erc20'), show Ethereum network
    let sourceChain;
    if (isEthSource) {
      // Native Ethereum coins - check network for testnet vs mainnet
      sourceChain = sourceCoin?.network === 'goerli' ? 'Ethereum Testnet' : 'Ethereum';
    } else {
      // Verus-based chains - use existing logic
      sourceChain = 'Verus';
      if (sourceSystemId && sourceSystemId !== VETH_SYSTEM_ID) {
        sourceChain = getNetworkDisplayName(sourceSystemId, 'Verus');
      }
    }
    
    let destChain = sourceChain; // Same chain by default
    let isSameChain = true;
    
    if (isCrossChain && exportTo) {
      // Special case: when exporting FROM Ethereum TO vETH bridge, the destination is Verus
      // (because vETH is the Ethereum bridge ON Verus, so you're sending to Verus)
      if (isEthSource && exportTo === VETH_SYSTEM_ID) {
        destChain = 'Verus';
      } else {
        destChain = getNetworkDisplayName(exportTo, exportTo);
      }
      isSameChain = false;
    }
    
    return { sourceChain, destChain, isSameChain };
  }, [sourceCoin, exportTo, isCrossChain]);

  // Get display name for current via option
  const currentViaDisplayName = useMemo(() => {
    if (!via) return null;
    
    // First try to find in viaOptions
    const viaOpt = viaOptions?.find(v => v.id === via);
    if (viaOpt?.name && viaOpt.name !== viaOpt.id) {
      return viaOpt.name;
    }
    
    // Try to look up in CoinDirectory
    try {
      const coin = CoinDirectory.findCoinObj(via);
      if (coin) return coin.display_name;
    } catch (e) {}
    
    // Fallback to the name from viaOptions or truncated ID
    if (viaOpt?.name) return viaOpt.name;
    return via.length > 12 ? `${via.substring(0, 8)}...` : via;
  }, [via, viaOptions]);

  // Format estimate output and calculate rate
  const { estimateDisplay, rateDisplay, outputFiatDisplay } = useMemo(() => {
    if (!estimate || !estimate.estimatedcurrencyout) {
      return { estimateDisplay: null, rateDisplay: null, outputFiatDisplay: null };
    }
    const outAmount = BigNumber(estimate.estimatedcurrencyout);
    const formattedOutput = outAmount.decimalPlaces(8).toString();
    
    // Calculate rate from input/output amounts
    let rate = null;
    if (cryptoAmountBnForSats && cryptoAmountBnForSats.isGreaterThan(0) && outAmount.isGreaterThan(0)) {
      rate = formatTruncatedRate(outAmount.dividedBy(cryptoAmountBnForSats), 8);
    }

    // Output fiat when possible
    let outputFiat = null;
    try {
      const coinIdForRate = targetCurrencyInfo?.coinId;
      const r = coinIdForRate ? getRate(coinIdForRate) : null;
      const rateBn = r != null ? BigNumber(r) : null;
      if (rateBn && !rateBn.isNaN() && rateBn.isFinite() && rateBn.isGreaterThan(0)) {
        outputFiat = formatFiat(outAmount.multipliedBy(rateBn));
      }
    } catch (e) {}
    
    return { estimateDisplay: formattedOutput, rateDisplay: rate, outputFiatDisplay: outputFiat };
  }, [estimate, cryptoAmountBnForSats, targetCurrencyInfo, getRate, formatFiat]);

  const showEstimateSkeleton = useMemo(() => {
    if (!isConversion) return false;
    if (!cryptoAmountBnForSats) return false; // no amount yet
    if (estimateError) return false;
    // Show skeleton while recalculating (including debounce window) and avoid showing stale estimates.
    return estimateLoading || !estimateDisplay;
  }, [isConversion, cryptoAmountBnForSats, estimateError, estimateLoading, estimateDisplay]);

  const inputSecondaryDisplay = useMemo(() => {
    if (amountFiat) {
      if (!sourceRateBn) return 'Rate unavailable';
      if (!cryptoAmountBnForSats) return `≈ — ${sourceCoin?.display_ticker || ''}`.trim();
      return `≈ ${cryptoAmountBnForSats.toString()} ${sourceCoin?.display_ticker || ''}`.trim();
    }

    // crypto input -> fiat preview
    if (!sourceRateBn) return 'Fiat unavailable';
    if (!cryptoAmountBnForSats) return `≈ ${fiatSymbol}—`;
    const fiat = formatFiat(cryptoAmountBnForSats.multipliedBy(sourceRateBn));
    return fiat ? `≈ ${fiat}` : `≈ ${fiatSymbol}—`;
  }, [amountFiat, cryptoAmountBnForSats, sourceCoin, sourceRateBn, formatFiat, fiatSymbol]);

  const canToggleAmountMode = useMemo(() => {
    // Switching to fiat requires a rate; switching back to crypto does not.
    return amountFiat ? true : Boolean(sourceRateBn);
  }, [amountFiat, sourceRateBn]);

  const availableFiatDisplay = useMemo(() => {
    if (!sourceRateBn) return null;
    const fiat = formatFiat(balanceBn.multipliedBy(sourceRateBn));
    return fiat ? `≈ ${fiat}` : null;
  }, [balanceBn, sourceRateBn, formatFiat]);

  // Build the subtitle text with chain info
  const subtitleText = useMemo(() => {
    if (isConversion) {
      if (chainInfo.isSameChain) {
        return `Convert ${sourceCoin?.display_ticker} → ${targetCurrencyInfo.ticker} on ${chainInfo.sourceChain}`;
      } else {
        return `Convert ${sourceCoin?.display_ticker} → ${targetCurrencyInfo.ticker} on ${chainInfo.destChain}`;
      }
    } else {
      if (chainInfo.isSameChain) {
        return `Send ${sourceCoin?.display_ticker} on ${chainInfo.sourceChain}`;
      } else {
        return `Send ${sourceCoin?.display_ticker} from ${chainInfo.sourceChain} to ${chainInfo.destChain}`;
      }
    }
  }, [isConversion, sourceCoin, targetCurrencyInfo, chainInfo]);

  if (!sourceCoin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#666' }}>No source currency selected.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Main content area */}
      <View style={styles.contentArea}>
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.contextLine}>{subtitleText}</Text>

          {/* Amount Hero */}
          <View style={styles.amountCard}>
            <View style={styles.amountRow}>
              {amountFiat && (
                <Text style={styles.amountHeroPrefix}>
                  {fiatSymbol}
                </Text>
              )}
              <RNTextInput
                ref={inputRef}
                value={inputValue}
                onChangeText={handleInputChange}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="0"
                placeholderTextColor="#A0A0A0"
                keyboardType="decimal-pad"
                autoCorrect={false}
                style={[
                  styles.amountHeroInput,
                  inputFocused && styles.amountHeroInputFocused,
                  isOverBalance && styles.amountHeroInputError,
                ]}
              />
            </View>

            <TouchableOpacity
              onPress={handleToggleAmountMode}
              activeOpacity={0.7}
              disabled={!canToggleAmountMode}
              style={[
                styles.secondaryDisplayContainer,
                !canToggleAmountMode && { opacity: 0.55 },
              ]}
            >
              <View style={styles.secondaryChip}>
                <Text style={styles.amountSecondaryText}>{inputSecondaryDisplay}</Text>
                <MaterialCommunityIcons
                  name="swap-vertical"
                  size={16}
                  color={canToggleAmountMode ? '#666' : '#BDBDBD'}
                  style={{ marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, isOverBalance && styles.balanceLabelError]}>
                Available: {balanceBn.decimalPlaces(4).toString()} {sourceCoin.display_ticker}
                {availableFiatDisplay ? ` (${availableFiatDisplay})` : ''}
              </Text>
              <TouchableOpacity
                onPress={handleMaxPress}
                style={styles.maxButton}
                activeOpacity={0.6}
              >
                <Text style={styles.maxButtonText}>
                  MAX
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Conversion Estimate - compact version */}
          {isConversion && (
            <View style={styles.estimateContainer}>
              {showEstimateSkeleton ? (
                <>
                  <Text style={styles.estimateLabel}>You receive</Text>
                  <View style={styles.estimateRowCompact}>
                    <View style={styles.skeletonIcon} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.skeletonLineLarge} />
                      <View style={styles.skeletonLineSmall} />
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.viaSingleRow}>
                    <Text style={styles.viaSingleLabel}>Conversion route</Text>
                    <View style={styles.skeletonLineRight} />
                  </View>
                  <View style={styles.viaSingleRow}>
                    <Text style={styles.viaSingleLabel}>Rate</Text>
                    <View style={styles.skeletonLineRightWide} />
                  </View>
                </>
              ) : estimateError ? (
                <Text style={styles.estimateError}>{estimateError}</Text>
              ) : estimateDisplay ? (
                <>
                  <Text style={styles.estimateLabel}>You receive</Text>
                  {/* Estimate output row */}
                  <View style={styles.estimateRowCompact}>
                    {targetCurrencyInfo.coinId && (
                      <View style={{ marginRight: 10 }}>
                        {RenderSquareCoinLogo(targetCurrencyInfo.coinId, {}, 24, 24)}
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.estimateMainRow}>
                        <Text style={styles.estimateAmountCompact}>
                          ≈ {estimateDisplay}
                        </Text>
                        <Text style={styles.estimateTickerCompact}>
                          {targetReceiveLabel}
                        </Text>
                      </View>
                      {outputFiatDisplay && (
                        <Text style={styles.estimateFiatCompact}>
                          ≈ {outputFiatDisplay}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Minimal route row (tappable only when a non-direct route is selected and alternatives exist) */}
                  {via && viaOptions && viaOptions.length > 1 ? (
                    <TouchableOpacity
                      style={styles.viaSelectorRow}
                      onPress={() => setViaSheetVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viaLabelRow}>Conversion route</Text>
                      <View style={styles.viaValueRow}>
                        <Text style={styles.viaValueText}>{currentViaDisplayName}</Text>
                        <Text style={styles.viaChevronRow}>›</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.viaSingleRow}>
                      <Text style={styles.viaSingleLabel}>Conversion route</Text>
                      <Text style={styles.viaSingleValue}>{currentViaDisplayName || 'Direct'}</Text>
                    </View>
                  )}

                  {/* Rate (always visible when available) */}
                  {rateDisplay ? (
                    <View style={styles.viaSingleRow}>
                      <Text style={styles.viaSingleLabel}>Rate</Text>
                      <Text style={styles.viaSingleValue}>
                        1 {sourceCoin.display_ticker} = {rateDisplay} {targetReceiveLabel}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.estimateEmpty}>Enter amount to see estimate</Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Continue Button - positioned above keyboard */}
      <View style={styles.buttonContainer}>
        <GradientButton
          onPress={handleContinue}
          disabled={!isValidAmount}
          style={styles.continueButton}
        >
          Continue
        </GradientButton>
      </View>

      {/* Via Sheet */}
      {viaSheetVisible && (
        <SendViaSheet
          visible={viaSheetVisible}
          viaOptions={viaOptions}
          viaEstimates={viaEstimates}
          currentVia={via}
          targetTicker={targetCurrencyInfo.ticker}
          targetFqn={convertToFqn || targetCurrencyInfo.ticker}
          onClose={() => setViaSheetVisible(false)}
          onSelect={handleViaSelect}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  headerCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 6,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentArea: {
    flex: 1,
    paddingTop: 8,
  },
  contextLine: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginTop: 8,
    lineHeight: 20,
  },
  amountCard: {
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: 8,
    alignItems: 'center', // Center content
    marginTop: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  amountHeroInput: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    textAlign: 'center',
    minWidth: 40,
  },
  amountHeroPrefix: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1A1A1A',
    marginRight: 2,
  },
  amountHeroInputFocused: {
    color: '#0F172A',
  },
  amountHeroInputError: {
    color: '#E53935',
  },
  secondaryDisplayContainer: {
    marginTop: 4,
    marginBottom: 12,
  },
  secondaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F1F4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  amountSecondaryText: {
    fontSize: 14,
    color: '#5F6A7A',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    width: '100%',
    marginVertical: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#888',
  },
  balanceLabelError: {
    color: '#FF4444',
  },
  // MAX button styled as outlined
  maxButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primaryColor,
  },
  maxButtonError: {
    borderColor: '#FF4444',
  },
  maxButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryColor,
    letterSpacing: 0.5,
  },
  maxButtonTextError: {
    color: '#FF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#FF4444',
    marginTop: 8,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  // Compact estimate container
  estimateContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E3E6EC',
    padding: 10,
    marginBottom: 10,
  },
  estimateRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  estimateLabel: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '700',
    marginBottom: 6,
  },
  estimateMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  estimateAmountCompact: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  estimateTickerCompact: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 6,
  },
  estimateFiatCompact: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  // Skeleton blocks (match Valu service skeleton style: static grey blocks, no layout jump)
  skeletonIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
    marginRight: 10,
  },
  skeletonLineLarge: {
    height: 18,
    width: '65%',
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
    marginBottom: 6,
  },
  skeletonLineSmall: {
    height: 12,
    width: '40%',
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
  },
  skeletonLineRight: {
    height: 12,
    width: 96,
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
  },
  skeletonLineRightWide: {
    height: 12,
    width: 160,
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
  },
  // Via selector on separate row (tappable, multiple options)
  viaSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  viaLabelRow: {
    fontSize: 13,
    color: '#888',
  },
  viaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viaValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryColor,
  },
  viaChevronRow: {
    fontSize: 16,
    color: '#888',
    marginLeft: 4,
  },
  // Single via route display (non-tappable)
  viaSingleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  viaSingleLabel: {
    fontSize: 13,
    color: '#888',
  },
  viaSingleValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 28,
    backgroundColor: 'white',
  },
  continueButton: {
    borderRadius: 24,
  },
});

export default SendWizardAmount;

