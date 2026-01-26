/*
  AddressBookEditSheet
  - Bottom sheet modal for adding/editing address book entries
  - Includes address validation and type auto-detection
  - Styled to match app input patterns
  - Created 2026-01-22
  - Updated 2026-01-22: Made validation more permissive to support all
    cryptocurrency address formats (Bitcoin, Litecoin, etc.)
  - Updated 2026-01-22: Added truncated address preview (8...8 format) below
    input so users can verify both start and end of pasted addresses.
  - Updated 2026-01-22: Fixed keyboard handling using marginBottom approach
    (matching BuySellSheet pattern)
*/

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput as RNTextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  Clipboard,
  Alert,
} from 'react-native';
import { Portal, Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from '../../../globals/colors';
import SemiModal from '../../../components/SemiModal';
import GradientButton from '../../../components/GradientButton';
import { 
  detectAddressType, 
  ADDRESS_TYPE_LABELS,
  isValidAddressFormat,
  truncateAddress,
} from '../../../utils/constants/addressBook';
import { ethers } from 'ethers';

const AddressBookEditSheet = ({
  visible,
  onClose,
  onSave,
  initialAddress = '',
  initialLabel = '',
  initialType = null,
  editMode = false,
  addressId = null,
}) => {
  const insets = useSafeAreaInsets();
  const paddingBottom = 16 + insets.bottom;

  const [address, setAddress] = useState(initialAddress);
  const [label, setLabel] = useState(initialLabel);
  const [addressFocused, setAddressFocused] = useState(false);
  const [labelFocused, setLabelFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const labelInputRef = useRef(null);
  const addressInputRef = useRef(null);

  // Track keyboard to adjust sheet position
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showListener?.remove();
      hideListener?.remove();
    };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setAddress(initialAddress);
      setLabel(initialLabel);
      setValidationError(null);
      setSaving(false);
      setKeyboardHeight(0);
    }
  }, [visible, initialAddress, initialLabel]);

  // Auto-detect address type
  const detectedType = useMemo(() => {
    return detectAddressType(address);
  }, [address]);

  // Validate address
  const validateAddress = useCallback((addr) => {
    if (!addr || addr.trim() === '') {
      return { valid: false, error: null };
    }

    const trimmed = addr.trim();

    // VerusID (ends with @)
    if (trimmed.endsWith('@')) {
      if (trimmed.length < 2) {
        return { valid: false, error: 'VerusID name is required before @' };
      }
      return { valid: true, error: null };
    }

    // Ethereum address - use ethers for strict validation
    if (trimmed.startsWith('0x')) {
      try {
        if (ethers.isAddress(trimmed)) {
          return { valid: true, error: null };
        }
      } catch (e) {}
      
      if (trimmed.length < 42) {
        return { valid: false, error: null }; // Still typing
      }
      return { valid: false, error: 'Invalid Ethereum address' };
    }

    // For all other addresses, use the permissive format check
    // This allows Bitcoin, Litecoin, Verus, and other crypto addresses
    if (isValidAddressFormat(trimmed)) {
      return { valid: true, error: null };
    }

    // If still typing (short address), don't show error yet
    if (trimmed.length < 25) {
      return { valid: false, error: null };
    }

    // Address is long enough but not recognized - show helpful message
    // but still allow saving if it looks like it could be valid
    const detectedType = detectAddressType(trimmed);
    if (detectedType) {
      return { valid: true, error: null };
    }

    // Check if it's at least alphanumeric (could be a coin we don't recognize)
    if (/^[a-zA-Z0-9:]+$/.test(trimmed) && trimmed.length >= 20) {
      return { valid: true, error: null };
    }

    return { valid: false, error: 'Address format not recognized' };
  }, []);

  // Update validation on address change
  useEffect(() => {
    const { error } = validateAddress(address);
    setValidationError(error);
  }, [address, validateAddress]);

  const isValid = useMemo(() => {
    const { valid } = validateAddress(address);
    return valid && label.trim().length > 0;
  }, [address, label, validateAddress]);

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setAddress(text.trim());
      }
    } catch (e) {
      console.warn('Failed to read clipboard:', e);
    }
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!isValid || saving) return;

    Keyboard.dismiss();
    setSaving(true);

    try {
      await onSave({
        id: addressId,
        address: address.trim(),
        label: label.trim(),
        type: detectedType,
      });
      onClose();
    } catch (e) {
      console.warn('Failed to save address:', e);
      Alert.alert('Error', e.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, onSave, addressId, address, label, detectedType, onClose]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <Portal>
      <SemiModal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={handleClose}
        title={editMode ? 'Edit Address' : 'Add Address'}
        closeDisabled={saving}
        flexHeight={0.01}
        contentContainerStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flex: 0,
          width: '100%',
          alignSelf: 'flex-end',
          maxHeight: '80%',
          marginBottom: keyboardHeight > 0 ? keyboardHeight : 0,
        }}
      >
        <View style={[styles.contentContainer, { paddingBottom }]}>
          {/* Label input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Name</Text>
            <View
              style={[
                styles.inputContainer,
                labelFocused && styles.inputFocused,
              ]}
            >
              <RNTextInput
                ref={labelInputRef}
                value={label}
                onChangeText={setLabel}
                onFocus={() => setLabelFocused(true)}
                onBlur={() => setLabelFocused(false)}
                placeholder="e.g., Mom's wallet"
                placeholderTextColor="#999"
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="next"
                style={styles.input}
                editable={!saving}
                onSubmitEditing={() => {
                  if (!editMode) {
                    addressInputRef.current?.focus();
                  }
                }}
              />
            </View>
          </View>

          {/* Address input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Address</Text>
            <View
              style={[
                styles.inputContainer,
                addressFocused && styles.inputFocused,
                validationError && styles.inputError,
              ]}
            >
              <RNTextInput
                ref={addressInputRef}
                value={address}
                onChangeText={setAddress}
                onFocus={() => setAddressFocused(true)}
                onBlur={() => setAddressFocused(false)}
                placeholder="R-address, i-address, VerusID, or 0x..."
                placeholderTextColor="#999"
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="done"
                style={styles.input}
                editable={!saving && !editMode}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            {/* Action row */}
            {!editMode && (
              <View style={styles.actionsRow}>
                <TouchableOpacity 
                  style={styles.actionChip} 
                  onPress={handlePaste}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <MaterialCommunityIcons name="content-paste" size={16} color="#666" />
                  <Text style={styles.actionChipText}>Paste</Text>
                </TouchableOpacity>
              </View>
            )}

            {validationError && (
              <Text style={styles.errorText}>{validationError}</Text>
            )}

            {/* Detected type indicator and address preview */}
            {detectedType && !validationError && (
              <View style={styles.validationRow}>
                <View style={styles.typeIndicator}>
                  <MaterialCommunityIcons 
                    name="check-circle" 
                    size={14} 
                    color={Colors.verusGreenColor} 
                  />
                  <Text style={styles.typeIndicatorText}>
                    {ADDRESS_TYPE_LABELS[detectedType] || detectedType}
                  </Text>
                </View>
                {/* Truncated address preview - shows first 8 and last 8 chars */}
                {address.trim().length > 20 && (
                  <View style={styles.addressPreview}>
                    <Text style={styles.addressPreviewText}>
                      {truncateAddress(address.trim(), 8, 8)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Save button */}
          <View style={styles.buttonContainer}>
            <GradientButton
              onPress={handleSave}
              disabled={!isValid || saving}
              style={styles.saveButton}
            >
              {saving ? (
                <ActivityIndicator color={Colors.secondaryColor} size={18} />
              ) : (
                editMode ? 'Update' : 'Save'
              )}
            </GradientButton>
          </View>
        </View>
      </SemiModal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 16,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    height: 52,
  },
  inputFocused: {
    backgroundColor: '#FFF',
    borderColor: Colors.primaryColor,
    shadowColor: Colors.primaryColor,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  inputError: {
    backgroundColor: '#FFF',
    borderColor: Colors.warningButtonColor,
    shadowColor: Colors.warningButtonColor,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  actionChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    color: Colors.warningButtonColor,
    marginTop: 8,
  },
  validationRow: {
    marginTop: 10,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeIndicatorText: {
    fontSize: 13,
    color: Colors.verusGreenColor,
    fontWeight: '500',
  },
  addressPreview: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addressPreviewText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#555',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  saveButton: {
    width: '100%',
  },
});

export default AddressBookEditSheet;
