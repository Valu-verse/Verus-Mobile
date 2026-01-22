/*
  SendWizardRecipient
  - Step 4: Enter or select recipient address
  - Supports "Send to self" for own addresses
  - Validates address based on destinationAddressType from context
  - Includes QR scanner and paste functionality
  - Created 2024-12-09
  - Updated 2024-12-09: Uses destinationAddressType for validation, added QR/paste buttons
  - Updated 2024-12-15: VerusID selection now populates VerusID name instead of i-address
  - Updated 2026-01-15: Added a header close X to exit the send flow.
  - Updated 2026-01-22: Styled address input to match Unlock password input pattern
    (matching the search inputs in SendWizardSelectSource and SendWizardSelectTarget).
*/

import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, TextInput as RNTextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions, Clipboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, Button, List, IconButton } from 'react-native-paper';
import { useObjectSelector } from '../../hooks/useObjectSelector';
import Colors from '../../globals/colors';
import { useSendWizard } from './SendWizardContext';
import SendSelfAddressSheet from './components/SendSelfAddressSheet';
import { ethers } from 'ethers';
import { fromBase58Check } from 'verus-typescript-primitives';
import { ADDRESS_TYPE } from './sendWizardDisplayInfo';
import BarcodeReader from '../../components/BarcodeReader/BarcodeReader';
import Styles from '../../styles';
import { ETH, ERC20, VRPC } from '../../utils/constants/intervalConstants';
import GradientButton from '../../components/GradientButton';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const SendWizardRecipient = () => {
  const navigation = useNavigation();
  const { height } = Dimensions.get('window');
  const { state, setRecipient, setStep } = useSendWizard();
  const { sourceCoin, exportTo, destinationAddressType } = state;

  const activeAccount = useObjectSelector((s) => s.authentication.activeAccount);
  const allSubWallets = useObjectSelector((s) => s.coinMenus.allSubWallets);

  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [selfSheetVisible, setSelfSheetVisible] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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
      headerShown: !scannerOpen, // Hide header when scanner is open
    });
  }, [navigation, scannerOpen, renderCloseButton]);

  // Get placeholder and hint text based on destination address type
  const placeholderText = useMemo(() => {
    if (destinationAddressType === ADDRESS_TYPE.ETHEREUM) {
      return '0x... Ethereum address';
    }
    return 'R-address, i-address, or VerusID';
  }, [destinationAddressType]);

  const hintText = useMemo(() => {
    if (destinationAddressType === ADDRESS_TYPE.ETHEREUM) {
      return 'Enter a valid Ethereum address starting with 0x';
    }
    return 'Enter a Verus R-address, i-address, or VerusID (ending with @)';
  }, [destinationAddressType]);

  // Get own addresses for "Send to self" based on destination address type
  // For ETH: uses activeAccount.keys (like ConvertOrCrossChainSendForm does)
  // For Verus: uses allSubWallets VRPC channels
  const ownAddresses = useMemo(() => {
    const addresses = [];
    const seen = new Set();

    if (destinationAddressType === ADDRESS_TYPE.ETHEREUM) {
      // For Ethereum destinations, get addresses from activeAccount.keys
      // This is how the legacy flow gets ETH addresses (see ConvertOrCrossChainSendForm.js line 579)
      if (activeAccount?.keys) {
        for (const coinId of Object.keys(activeAccount.keys)) {
          const coinKeys = activeAccount.keys[coinId];
          
          // Try ETH channel first, then ERC20
          const ethAddresses = coinKeys?.[ETH]?.addresses || coinKeys?.[ERC20]?.addresses || [];
          
          ethAddresses.forEach((addr) => {
            if (addr && addr.startsWith('0x') && !seen.has(addr)) {
              seen.add(addr);
              const addrTitle = addr.substring(0, 8) + '...' + addr.substring(addr.length - 8);
              addresses.push({
                id: `eth_${addr}`,
                address: addr,
                name: addrTitle,
                type: 'ethereum',
              });
            }
          });
        }
      }
    } else {
      // For Verus/pBaaS destinations, get VRSC subwallet addresses from allSubWallets
      if (allSubWallets) {
        const vrscSubWallets = allSubWallets['VRSC'] || allSubWallets['VRSCTEST'] || [];
        vrscSubWallets.forEach((sw) => {
          // Get address from subwallet channel (format: VRPC.address.systemId)
          const channelId = sw.channel || '';
          const parts = channelId.split('.');
          const addr = parts.length > 1 ? parts[1] : null;
          
          if (addr && !addr.startsWith('0x') && !seen.has(addr)) {
            seen.add(addr);
            // Check if name is a VerusID (ends with @)
            const isVerusID = sw.name && sw.name.endsWith('@');
            addresses.push({
              id: sw.id,
              address: addr,
              name: sw.name || 'My Verus address',
              type: 'verus',
              isVerusID,
              verusIdName: isVerusID ? sw.name : null,
            });
          }
        });
      }
    }

    return addresses;
  }, [activeAccount, allSubWallets, destinationAddressType]);

  // Validate address based on destination address type
  const validateAddress = useCallback(
    (address) => {
      if (!address || address.trim() === '') {
        return { valid: false, error: null };
      }

      const trimmed = address.trim();

      if (destinationAddressType === ADDRESS_TYPE.ETHEREUM) {
        // Ethereum address validation
        if (!trimmed.startsWith('0x')) {
          return { valid: false, error: 'Ethereum address must start with 0x' };
        }
        try {
          if (ethers.isAddress(trimmed)) {
            return { valid: true, error: null };
          }
        } catch (e) {}
        return { valid: false, error: 'Invalid Ethereum address' };
      } else {
        // Verus address validation (R-address, i-address, VerusID)
        
        // VerusID check (ends with @)
        if (trimmed.endsWith('@')) {
          return { valid: true, error: null };
        }

        // ETH address is not valid for Verus destinations
        if (trimmed.startsWith('0x')) {
          return { valid: false, error: 'Ethereum addresses are not valid for this destination. Use a Verus address.' };
        }

        // Base58 address check (Verus R-address, i-address)
        try {
          const decoded = fromBase58Check(trimmed);
          if (decoded && decoded.hash) {
            // R-address (version 60) or i-address (version 102)
            if (decoded.version === 60 || decoded.version === 102) {
              return { valid: true, error: null };
            }
          }
        } catch (e) {}

        // If starts with R or i, might be partially typed
        if (trimmed.startsWith('R') || trimmed.startsWith('i')) {
          if (trimmed.length < 34) {
            return { valid: false, error: null }; // Still typing
          }
          return { valid: false, error: 'Invalid Verus address format' };
        }

        // Could be a VerusID being typed
        if (trimmed.length > 0 && !trimmed.includes('@')) {
          return { valid: false, error: null }; // Might be typing a VerusID
        }

        return { valid: false, error: 'Enter a valid address or VerusID' };
      }
    },
    [destinationAddressType],
  );

  // Update validation on input change
  useEffect(() => {
    const { error } = validateAddress(inputValue);
    setValidationError(error);
  }, [inputValue, validateAddress]);

  const isValidAddress = useMemo(() => {
    const { valid, error } = validateAddress(inputValue);
    return valid && !error && inputValue.trim().length > 0;
  }, [inputValue, validateAddress]);

  const handleContinue = useCallback(() => {
    if (!isValidAddress) return;

    setRecipient(inputValue.trim(), null);
    setStep(5);
    navigation.navigate('SendWizardConfirm');
  }, [isValidAddress, inputValue, setRecipient, setStep, navigation]);

  const handleSelfSelect = useCallback((addressItem) => {
    // If it's a VerusID, use the VerusID name (e.g., "MyName@"), otherwise use the address
    const valueToSet = addressItem.verusIdName || addressItem.address;
    setInputValue(valueToSet);
    setSelfSheetVisible(false);
  }, []);

  const handleSelfPress = useCallback(() => {
    if (ownAddresses.length === 0) {
      Alert.alert('No addresses', 'You don\'t have any addresses of the required type.');
      return;
    }

    if (ownAddresses.length === 1) {
      handleSelfSelect(ownAddresses[0]);
    } else {
      setSelfSheetVisible(true);
    }
  }, [ownAddresses, handleSelfSelect]);

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setInputValue(text.trim());
      }
    } catch (e) {
      console.warn('Failed to read clipboard:', e);
    }
  }, []);

  // QR Scanner
  const handleScan = useCallback((codes) => {
    const result = codes[0]?.value;
    setScannerOpen(false);

    if (result != null && typeof result === 'string' && result.length <= 5000) {
      // Clean up the result - might contain payment request prefix
      let address = result;
      
      // Handle various QR formats
      if (address.includes(':')) {
        // Bitcoin/Verus URI format like "verus:address" or "ethereum:address"
        const parts = address.split(':');
        address = parts[parts.length - 1];
      }
      if (address.includes('?')) {
        // Remove query parameters
        address = address.split('?')[0];
      }
      
      setInputValue(address.trim());
    } else {
      Alert.alert('Error', 'Could not read QR code');
    }
  }, []);

  const toggleScanner = useCallback(() => {
    setScannerOpen(!scannerOpen);
  }, [scannerOpen]);

  if (!sourceCoin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#666' }}>No source currency selected.</Text>
      </View>
    );
  }

  // QR Scanner view
  if (scannerOpen) {
    return (
      <View style={Styles.blackRoot}>
        <BarcodeReader
          prompt={`Scan ${destinationAddressType === ADDRESS_TYPE.ETHEREUM ? 'Ethereum' : 'Verus'} address`}
          onScan={handleScan}
          button={() => (
            <Button
              mode="contained"
              buttonColor={Colors.warningButtonColor}
              onPress={toggleScanner}
              style={{ marginBottom: 48 }}
            >
              Cancel
            </Button>
          )}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.mainTitle}>Recipient</Text>
          <Text style={styles.subtitle}>
            Enter the destination address
          </Text>

          {/* Address Input */}
          <View style={styles.inputContainer}>
            <View
              style={[
                styles.addressInputContainer,
                inputFocused && styles.addressInputFocused,
                validationError && styles.addressInputError,
              ]}
            >
              <RNTextInput
                value={inputValue}
                onChangeText={setInputValue}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={placeholderText}
                placeholderTextColor="#999"
                autoCorrect={false}
                autoCapitalize="none"
                multiline={true}
                numberOfLines={2}
                style={styles.addressInput}
              />
            </View>
            
            {/* Action Buttons Row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={styles.actionChip} 
                onPress={handlePaste}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="content-paste" size={18} color="#666" style={{ marginRight: 6 }} />
                <Text style={styles.actionChipText}>Paste</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionChip} 
                onPress={toggleScanner}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="qrcode-scan" size={18} color="#666" style={{ marginRight: 6 }} />
                <Text style={styles.actionChipText}>Scan QR</Text>
              </TouchableOpacity>
            </View>

            {validationError && (
              <Text style={styles.errorText}>{validationError}</Text>
            )}

            {/* Hint */}
            <View style={styles.hintsContainer}>
              <Text style={styles.hintText}>{hintText}</Text>
            </View>
          </View>

          {/* Send to Self */}
          {ownAddresses.length > 0 && (
            <View style={styles.selfSection}>
              <List.Item
                onPress={handleSelfPress}
                right={(props) => <List.Icon {...props} icon="chevron-right" color="#BDBDBD" />}
                title={() => (
                  <Text style={styles.selfTitle}>
                    Send to self
                  </Text>
                )}
                description={() => (
                  <Text style={styles.selfDescription}>
                    Use one of your own {destinationAddressType === ADDRESS_TYPE.ETHEREUM ? 'Ethereum' : 'Verus'} addresses
                  </Text>
                )}
                style={styles.selfItem}
                rippleColor="rgba(0,0,0,0.05)"
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.buttonContainer}>
        <GradientButton
          onPress={handleContinue}
          disabled={!isValidAddress}
          style={styles.continueButton}
        >
          Continue
        </GradientButton>
      </View>

      {/* Self Address Sheet */}
      {selfSheetVisible && (
        <SendSelfAddressSheet
          visible={selfSheetVisible}
          addresses={ownAddresses}
          onClose={() => setSelfSheetVisible(false)}
          onSelect={handleSelfSelect}
          addressType={destinationAddressType}
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
  scrollContent: {
    flexGrow: 1,
    paddingTop: 8,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 4,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  addressInputContainer: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 16,
    minHeight: 56,
  },
  addressInputFocused: {
    backgroundColor: '#FFF',
    borderColor: Colors.primaryColor,
    shadowColor: Colors.primaryColor,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  addressInputError: {
    backgroundColor: '#FFF',
    borderColor: Colors.warningButtonColor,
    shadowColor: Colors.warningButtonColor,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  addressInput: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: 16,
    color: '#000',
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: Colors.warningButtonColor,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  hintsContainer: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  hintText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  selfSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  selfItem: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 4,
  },
  selfTitle: {
    fontSize: 16, 
    fontWeight: '600', 
    color: 'black'
  },
  selfDescription: {
    fontSize: 13, 
    color: '#888', 
    marginTop: 4
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 28,
    backgroundColor: 'white',
  },
  continueButton: {
    width: '100%',
  },
});

export default SendWizardRecipient;
