/*
  Unlock screen (iterated):
  - Aligns CTA styling with the rest of the app by reusing `GradientButton` (matching the prior `Login` screen buttons).
  - Reuses the existing CreateProfile password input styling pattern (custom RN TextInput w/ focus border + soft background).
  - Restyles Switch/Forgot sheets to match `TransferSheet` conventions (header spacing, safe-area padding, card-like list rows).
  - Keeps auto biometrics, default-profile priority, and top-right "Powered by Verus" + "More" affordances.
  - Sets the keyboard action key to "Go" on the password field to better match the unlock intent.
  - Adds immediate unlock feedback: inline loading state + spinner inside the Unlock button.
  - Adds the slow-motion onboarding gradient video as a background (matching `Login.js`) for brand continuity.
  - 2026-01-13: Use correct platform biometry names (Face ID / Touch ID / Fingerprint / Face Unlock) and
    reduce the amount of blue in the biometric affordance (more neutral icon + label styling).
  - 2026-01-13: Fix misleading unlock errors by distinguishing real "incorrect password" failures from
    other initialization/network/storage failures (which previously surfaced as "Incorrect password").
  - 2026-01-13: Suppress the auto-biometric prompt when arriving here from an explicit Settings "Lock profile"
    action, so users can switch profiles first (biometrics remains available via tap).
  - 2026-01-13: Prevent concurrent unlock attempts (manual biometric tap vs auto-effect) which could
    temporarily desync the session keychain credential and produce transient "Unable to decrypt sensitive info"
    errors even though unlock ultimately succeeds.
  - 2026-01-13: Remove the native "Authentication Error" popup for incorrect password on this screen, replacing it
    with inline error messaging + shake/error outline for better UX.
  - 2026-01-13: Update the "Lost access?" sheet to use `SemiModal`'s standardized header (title + X close button).
*/
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  TextInput as RNTextInput,
} from 'react-native';
import {ActivityIndicator, Button, List, Portal, Text} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import {SafeAreaView} from 'react-native';
import VerusLogoWhite from '../../images/customIcons/verus-logo-white.svg';
import FaceRecognitionIcon from '../../images/customIcons/face-recognition.svg';
import Colors from '../../globals/colors';
import SemiModal from '../../components/SemiModal';
import SignedOutDropdown from '../SignedOutDropdown/SignedOutDropdown';
import {useObjectSelector} from '../../hooks/useObjectSelector';
import {getSupportedBiometryType} from '../../utils/keychain/keychain';
import {getBiometricPassword} from '../../utils/keychain/biometrics';
import {initializeAccountData} from '../../actions/actions/account/dispatchers/account';
import GradientButton from '../../components/GradientButton';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  saveGeneralSettings,
  setSuppressUnlockAutoBiometrics,
} from '../../actions/actionCreators';
import * as Keychain from 'react-native-keychain';

const BIOMETRIC_PROMPT = 'Authenticate to unlock profile';

function isIncorrectPasswordError(error) {
  const message = String(error?.message ?? error ?? '');

  // `checkPinForUser()` throws "Incorrect password" (and may also produce an Alert).
  if (/incorrect password/i.test(message)) return true;

  // `initializeAccountData()` throws this when validation fails (usually due to bad password/decryption).
  if (/failed to validate and initialize account/i.test(message)) return true;

  return false;
}

function sortAccountsAlphabetically(accounts) {
  return [...accounts].sort((a, b) =>
    String(a?.id ?? '').localeCompare(String(b?.id ?? ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    }),
  );
}

function getInitialSelectedAccount({accounts, defaultAccountHash}) {
  if (!accounts || accounts.length === 0) return null;

  const defaultMatch =
    defaultAccountHash != null
      ? accounts.find(a => a?.accountHash === defaultAccountHash)
      : null;

  return defaultMatch ?? accounts[0];
}

const Unlock = props => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const unlockInFlightRef = useRef(false);
  const manualBiometricInFlightRef = useRef(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const defaultAccountHash = useSelector(
    state => state.settings.generalWalletSettings.defaultAccount,
  );

  const suppressUnlockAutoBiometrics = useSelector(
    state => state.authentication.suppressUnlockAutoBiometrics,
  );

  const accounts = useObjectSelector(state => state.authentication.accounts);
  const hasAccount = accounts != null && accounts.length > 0;

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [supportedBiometryType, setSupportedBiometryType] = useState(null);

  const [switchSheetVisible, setSwitchSheetVisible] = useState(false);
  const [forgotSheetVisible, setForgotSheetVisible] = useState(false);
  const [enableBiometricsInfoVisible, setEnableBiometricsInfoVisible] =
    useState(false);

  const sortedAccounts = useMemo(
    () => sortAccountsAlphabetically(accounts ?? []),
    [accounts],
  );

  const biometricUI = useMemo(() => {
    const type = supportedBiometryType?.type;
    const displayName = supportedBiometryType?.display_name;
    const supported = supportedBiometryType?.biometry === true;

    if (!supported || !displayName || displayName === 'None') {
      return {visible: false, isFace: false, label: ''};
    }

    const isFace =
      type === Keychain.BIOMETRY_TYPE.FACE_ID ||
      type === Keychain.BIOMETRY_TYPE.FACE ||
      /face/i.test(displayName);

    let label = `Unlock with ${displayName}`;

    if (Platform.OS === 'ios') {
      if (type === Keychain.BIOMETRY_TYPE.FACE_ID) label = 'Unlock with Face ID';
      if (type === Keychain.BIOMETRY_TYPE.TOUCH_ID) label = 'Unlock with Touch ID';
    } else {
      // Android branding is generic; "Face Unlock" is the most common user-facing term.
      if (type === Keychain.BIOMETRY_TYPE.FACE) label = 'Unlock with Face Unlock';
      if (type === Keychain.BIOMETRY_TYPE.FINGERPRINT) label = 'Unlock with Fingerprint';
    }

    return {visible: true, isFace, label};
  }, [supportedBiometryType]);

  const defaultAccount = useMemo(() => {
    if (!sortedAccounts.length || defaultAccountHash == null) return null;
    return sortedAccounts.find(a => a?.accountHash === defaultAccountHash) ?? null;
  }, [sortedAccounts, defaultAccountHash]);

  // Initialize selection (default first, otherwise first alphabetically)
  useEffect(() => {
    if (!hasAccount) return;

    setSelectedAccount(prev => {
      if (prev != null) return prev;
      return getInitialSelectedAccount({
        accounts: sortedAccounts,
        defaultAccountHash,
      });
    });
  }, [hasAccount, sortedAccounts, defaultAccountHash]);

  const clearErrors = useCallback(() => setErrorText(null), []);

  const triggerPasswordErrorShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {toValue: 1, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: -1, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 1, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: true}),
    ]).start();
  }, [shakeAnim]);

  const handleRecoverSeed = useCallback(() => {
    props.navigation.navigate('RecoverSeeds');
  }, [props.navigation]);

  const handleRevokeRecover = useCallback(() => {
    props.navigation.navigate('RevokeRecover');
  }, [props.navigation]);

  const handleCreateProfile = useCallback(() => {
    setForgotSheetVisible(false);
    setSwitchSheetVisible(false);
    props.navigation.navigate('CreateProfile');
  }, [props.navigation]);

  const tryUnlockAccount = useCallback(
    async key => {
      if (!selectedAccount) return;
      if (unlockInFlightRef.current) return;
      unlockInFlightRef.current = true;
      setLoading(true);
      clearErrors();
      Keyboard.dismiss();

      try {
        // We do not change default here; selection follows the persisted default account.
        await initializeAccountData(selectedAccount, key, false, undefined, {
          alertOnFail: false,
        });
        setErrorText(null);
        // Clear one-shot suppression after a successful unlock (password or biometric).
        dispatch(setSuppressUnlockAutoBiometrics(false));
      } catch (e) {
        if (isIncorrectPasswordError(e)) {
          setErrorText('Incorrect password. Try again.');
          triggerPasswordErrorShake();
        } else {
          // This can happen due to initialization issues (storage/migrations/network/etc).
          // Avoid misleading the user into thinking their password is wrong.
          if (__DEV__) console.warn('Unlock failed (non-auth error):', e);
          setErrorText('Couldn’t unlock right now. Please try again.');
        }
      } finally {
        setLoading(false);
        unlockInFlightRef.current = false;
      }
    },
    [selectedAccount, clearErrors, dispatch, triggerPasswordErrorShake],
  );

  const tryAutoBiometricUnlock = useCallback(async () => {
    if (!selectedAccount?.biometry) return;
    if (unlockInFlightRef.current) return;

    try {
      const supported = await getSupportedBiometryType();
      if (!supported?.biometry) return;

      const key = await getBiometricPassword(
        selectedAccount.accountHash,
        BIOMETRIC_PROMPT,
      );

      if (key != null) {
        setPassword(key);
        await tryUnlockAccount(key);
      }
    } catch (e) {
      // Treat biometric cancel/fail as non-fatal; user can fall back to password.
    }
  }, [selectedAccount, tryUnlockAccount]);

  // Load supported biometry type once (used for icon decisions).
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const supported = await getSupportedBiometryType();
        if (mounted) setSupportedBiometryType(supported);
      } catch (e) {}
    })();

    return () => {
      mounted = false;
    };
  }, []);


  const handlePressBiometrics = useCallback(async () => {
    if (!selectedAccount) return;

    if (selectedAccount.biometry) {
      // Guard against concurrent biometric triggers (manual tap vs auto-effect).
      if (manualBiometricInFlightRef.current) return;
      manualBiometricInFlightRef.current = true;

      try {
        await tryAutoBiometricUnlock();
      } finally {
        // If we arrived here from an explicit lock action, require a user tap before prompting biometrics.
        // Only clear suppression AFTER the manual attempt is initiated, to prevent the auto-effect from
        // racing in parallel and causing transient session credential decrypt errors.
        if (suppressUnlockAutoBiometrics) {
          dispatch(setSuppressUnlockAutoBiometrics(false));
        }
        manualBiometricInFlightRef.current = false;
      }
      return;
    }

    setEnableBiometricsInfoVisible(true);
  }, [selectedAccount, tryAutoBiometricUnlock, suppressUnlockAutoBiometrics, dispatch]);

  const setDefaultProfile = useCallback(
    async accountHash => {
      if (!accountHash) return;
      try {
        dispatch(await saveGeneralSettings({defaultAccount: accountHash}));
      } catch (e) {
        // Non-fatal; default will remain unchanged
      }
    },
    [dispatch],
  );

  // Auto biometric prompt when the selected account changes (default priority).
  useEffect(() => {
    if (!selectedAccount) return;
    if (suppressUnlockAutoBiometrics) return;
    if (unlockInFlightRef.current) return;
    if (manualBiometricInFlightRef.current) return;
    if (switchSheetVisible || forgotSheetVisible || enableBiometricsInfoVisible)
      return;
    tryAutoBiometricUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAccount?.accountHash,
    suppressUnlockAutoBiometrics,
    switchSheetVisible,
    forgotSheetVisible,
    enableBiometricsInfoVisible,
  ]);

  // Safety: never let a one-shot suppression flag leak beyond this screen.
  useEffect(() => {
    return () => {
      dispatch(setSuppressUnlockAutoBiometrics(false));
    };
  }, [dispatch]);

  if (!hasAccount) {
    // This screen should only be reachable when `hasAccount` is true (RootStack routing).
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>No profiles found.</Text>
        <Button onPress={handleCreateProfile}>Create new profile</Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.topPills, {top: Math.max(insets.top, 16) + 8}]}>
        <View style={styles.poweredPill}>
          <Text style={styles.poweredText}>Powered by</Text>
          <VerusLogoWhite width={68} height={16} />
        </View>
        <SignedOutDropdown
          hasAccount={hasAccount}
          handleRecoverSeed={handleRecoverSeed}
          handleRevokeRecover={handleRevokeRecover}
        />
      </View>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Math.max(insets.top, 0)}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              // Leave space for bottom card
              {paddingBottom: Math.max(insets.bottom, 16) + 100},
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.unlockPanel}>
              {/* Profile section */}
              <View style={styles.panelSection}>
                <TouchableOpacity
                  onPress={() => setSwitchSheetVisible(true)}
                  activeOpacity={0.75}
                  style={styles.profileSelector}
                >
                   <Text style={styles.welcomeText}>{'Unlock profile'}</Text>
                   <View style={styles.profileNameRow}>
                      <Text style={styles.profileName} numberOfLines={1}>
                        {selectedAccount?.id ?? ''}
                      </Text>
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={24}
                        color={Colors.primaryColor}
                        style={{marginLeft: 4}}
                      />
                   </View>
                </TouchableOpacity>
              </View>

              {/* Biometrics Big Button (if enabled) */}
              {selectedAccount?.biometry && biometricUI.visible && (
                <View style={styles.biometricSection}>
                  <TouchableOpacity
                    onPress={handlePressBiometrics}
                    style={styles.biometricBigButton}
                    activeOpacity={0.8}
                  >
                     {biometricUI.isFace ? (
                      <FaceRecognitionIcon
                        width={48}
                        height={48}
                        fill={Colors.quaternaryColor}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="fingerprint"
                        size={56}
                        color={Colors.quaternaryColor}
                      />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.biometricLabel}>
                    {biometricUI.label}
                  </Text>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </View>
              )}

              {/* Password section */}
              <View style={styles.passwordSection}>
                <Animated.View
                  style={[
                    styles.passwordInputContainer,
                    passwordFocused && styles.passwordInputFocused,
                    !!errorText && styles.passwordInputError,
                    {
                      transform: [
                        {
                          translateX: shakeAnim.interpolate({
                            inputRange: [-1, 1],
                            outputRange: [-8, 8],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <RNTextInput
                    value={password}
                    onChangeText={text => {
                      setPassword(text);
                      if (errorText) clearErrors();
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder={'Enter password'}
                    placeholderTextColor={'#999'}
                    returnKeyType={'go'}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                    spellCheck={false}
                    secureTextEntry={!passwordVisible}
                    onSubmitEditing={() => tryUnlockAccount(password)}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity
                    onPress={() => setPasswordVisible(v => !v)}
                    style={styles.passwordEye}
                  >
                    <MaterialCommunityIcons
                      name={passwordVisible ? 'eye-off' : 'eye'}
                      size={20}
                      color={'#999'}
                    />
                  </TouchableOpacity>
                </Animated.View>

                {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

                <GradientButton
                  onPress={() => tryUnlockAccount(password)}
                  disabled={loading || password.length === 0 || !selectedAccount}
                  style={styles.unlockButton}
                >
                  {loading ? (
                    <View style={styles.unlockLoadingRow}>
                      <ActivityIndicator color={Colors.secondaryColor} size={16} />
                      <Text style={styles.unlockLoadingText}>{'Unlocking…'}</Text>
                    </View>
                  ) : (
                    'Unlock'
                  )}
                </GradientButton>

                <TouchableOpacity
                  onPress={() => setForgotSheetVisible(true)}
                  style={styles.forgotButton}
                >
                  <Text style={styles.linkTextNeutral}>
                    Lost access?
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>

      {/* Bottom Button (Create Profile) */}
      <View
        pointerEvents="box-none"
        style={[
          styles.bottomLinks,
          {bottom: Math.max(insets.bottom, 16) + 10},
        ]}
      >
        <Button
          mode="contained"
          onPress={handleCreateProfile}
          style={styles.createProfileButton}
          contentStyle={{ height: 44 }}
          uppercase={false}
          labelStyle={styles.createProfileLabel}
          buttonColor="#EBF6FF"
          textColor={Colors.primaryColor}
        >
          Create new profile
        </Button>
      </View>

      {/* Switch profile sheet */}
      <Portal>
        <SemiModal
          animationType="slide"
          transparent={true}
          visible={switchSheetVisible}
          onRequestClose={() => setSwitchSheetVisible(false)}
          flexHeight={0.01}
          contentContainerStyle={{
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            flex: 0,
            width: '100%',
            alignSelf: 'flex-end',
            paddingBottom: 12 + insets.bottom,
          }}
        >
          <View>
            <View style={styles.sheetHeader}>
              <Button
                onPress={() => setSwitchSheetVisible(false)}
                textColor={Colors.primaryColor}
              >
                Close
              </Button>
              <Text style={styles.sheetTitle}>Switch profile</Text>
              <View style={styles.sheetHeaderSpacer} />
            </View>

            {!!defaultAccount && (
              <>
                <Text style={styles.sheetSectionLabel}>Default</Text>
                <View style={styles.sheetListContainer}>
                  {(() => {
                    const acct = defaultAccount;
                    const isSelected =
                      acct.accountHash === selectedAccount?.accountHash;
                    const isDefault = acct.accountHash === defaultAccountHash;

                    return (
                      <View
                        style={[
                          styles.optionCard,
                          isSelected && styles.optionCardSelected,
                          isDefault && styles.optionCardBest,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.optionMain}
                          activeOpacity={0.75}
                          onPress={() => {
                            setSelectedAccount(acct);
                            setPassword('');
                            clearErrors();
                            setSwitchSheetVisible(false);
                          }}
                        >
                          <View style={styles.optionInfo}>
                            <View style={styles.nameRow}>
                              <Text style={styles.optionName}>{acct.id}</Text>
                              {isDefault && (
                                <View style={styles.bestBadge}>
                                  <Text style={styles.bestBadgeText}>DEFAULT</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>

                        <View style={styles.optionRight}>
                          <TouchableOpacity
                            onPress={() => {
                              setDefaultProfile(acct.accountHash);
                              setSelectedAccount(acct);
                              setPassword('');
                              clearErrors();
                            }}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Set as default"
                            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                          >
                            <MaterialCommunityIcons
                              name={isDefault ? 'star' : 'star-outline'}
                              size={22}
                              color={
                                isDefault ? Colors.infoButtonColor : '#B0B0B0'
                              }
                            />
                          </TouchableOpacity>
                          {isSelected ? (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={22}
                              color={Colors.verusGreenColor}
                              style={{marginLeft: 10}}
                            />
                          ) : (
                            <MaterialCommunityIcons
                              name="chevron-right"
                              size={20}
                              color="#CCC"
                              style={{marginLeft: 10}}
                            />
                          )}
                        </View>
                      </View>
                    );
                  })()}
                </View>
              </>
            )}

            <Text style={[styles.sheetSectionLabel, {marginTop: 12}]}>
              All profiles
            </Text>
            <ScrollView style={{maxHeight: 420}}>
              <View style={styles.sheetListContainer}>
                {sortedAccounts.map(acct => {
                  const isSelected =
                    acct.accountHash === selectedAccount?.accountHash;
                  const isDefault = acct.accountHash === defaultAccountHash;

                  return (
                    <View
                      key={acct.accountHash}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                        isDefault && styles.optionCardBest,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.optionMain}
                        activeOpacity={0.75}
                        onPress={() => {
                          setSelectedAccount(acct);
                          setPassword('');
                          clearErrors();
                          setSwitchSheetVisible(false);
                        }}
                      >
                        <View style={styles.optionInfo}>
                          <View style={styles.nameRow}>
                            <Text style={styles.optionName}>{acct.id}</Text>
                            {isDefault && (
                              <View style={styles.bestBadge}>
                                <Text style={styles.bestBadgeText}>DEFAULT</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.optionRight}>
                        <TouchableOpacity
                          onPress={() => {
                            setDefaultProfile(acct.accountHash);
                            setSelectedAccount(acct);
                            setPassword('');
                            clearErrors();
                          }}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel="Set as default"
                          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                        >
                          <MaterialCommunityIcons
                            name={isDefault ? 'star' : 'star-outline'}
                            size={22}
                            color={isDefault ? Colors.infoButtonColor : '#B0B0B0'}
                          />
                        </TouchableOpacity>
                        {isSelected ? (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={22}
                            color={Colors.verusGreenColor}
                            style={{marginLeft: 10}}
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color="#CCC"
                            style={{marginLeft: 10}}
                          />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </SemiModal>
      </Portal>

      {/* Forgot password sheet */}
      <Portal>
        <SemiModal
          animationType="slide"
          transparent={true}
          visible={forgotSheetVisible}
          onRequestClose={() => setForgotSheetVisible(false)}
          title="Lost access?"
          flexHeight={0.01}
          contentContainerStyle={{
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            flex: 0,
            width: '100%',
            alignSelf: 'flex-end',
            paddingBottom: 12 + insets.bottom,
          }}
        >
          <View style={styles.sheetBody}>
            <Text style={styles.sheetParagraph}>
              Passwords can’t be reset.
            </Text>
            <Text style={styles.sheetParagraph}>
              To regain access, create a new profile and import your seed in the
              profile setup flow.
            </Text>
            <GradientButton onPress={handleCreateProfile} style={{marginTop: 10}}>
              {'Create new profile'}
            </GradientButton>
          </View>
        </SemiModal>
      </Portal>

      {/* Enable biometrics info sheet (informational only) */}
      <Portal>
        <SemiModal
          animationType="slide"
          transparent={true}
          visible={enableBiometricsInfoVisible}
          onRequestClose={() => setEnableBiometricsInfoVisible(false)}
          flexHeight={0.01}
          contentContainerStyle={{
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            flex: 0,
            width: '100%',
            alignSelf: 'flex-end',
            paddingBottom: 12 + insets.bottom,
          }}
        >
          <View>
            <View style={styles.sheetHeader}>
              <Button
                onPress={() => setEnableBiometricsInfoVisible(false)}
                textColor={Colors.primaryColor}
              >
                Close
              </Button>
              <Text style={styles.sheetTitle}>Enable biometrics</Text>
              <View style={styles.sheetHeaderSpacer} />
            </View>

            <View style={styles.sheetBody}>
              <Text style={styles.sheetParagraph}>
                Biometric unlock isn’t enabled for this profile.
              </Text>
              <Text style={styles.sheetParagraph}>
                After unlocking, enable it in Settings → Profile Settings → Setup
                Biometric Authentication.
              </Text>
            </View>
          </View>
        </SemiModal>
      </Portal>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Unlock;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.secondaryColor,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topPills: {
    position: 'absolute',
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  poweredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(49, 101, 212, 0.95)',
    marginRight: 8,
  },
  poweredText: {
    color: Colors.secondaryColor,
    fontSize: 11.5,
    fontWeight: '600',
    marginRight: 8,
    letterSpacing: -0.2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 80,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  unlockPanel: {
    // Transparent container now
    marginBottom: 40,
  },
  panelSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileSelector: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.quinaryColor,
    letterSpacing: -0.5,
  },
  biometricSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  biometricBigButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E6E6E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  biometricLabel: {
    fontSize: 13,
    color: Colors.quaternaryColor,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
    marginTop: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EEE',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#BBB',
    fontSize: 12,
    fontWeight: '600',
  },
  passwordSection: {
    width: '100%',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 16,
    height: 52,
  },
  passwordInputFocused: {
    backgroundColor: '#FFF',
    borderColor: Colors.primaryColor,
    shadowColor: Colors.primaryColor,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
  },
  passwordInputError: {
    backgroundColor: '#FFF',
    borderColor: Colors.warningButtonColor,
    shadowColor: Colors.warningButtonColor,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  passwordEye: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
  },
  errorText: {
    marginBottom: 16,
    color: Colors.warningButtonColor,
    fontSize: 13,
    textAlign: 'center',
  },
  unlockButton: {
    marginBottom: 16,
  },
  unlockLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  unlockLoadingText: {
    color: Colors.secondaryColor,
    fontWeight: '700',
    fontSize: 16,
  },
  forgotButton: {
    alignSelf: 'center',
    padding: 8,
  },
  linkTextNeutral: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomLinks: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  createProfileButton: {
    borderRadius: 22,
    borderWidth: 0,
    backgroundColor: '#EBF6FF',
    width: 180,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  createProfileLabel: {
    color: Colors.primaryColor,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'none',
    letterSpacing: -0.2,
  },
  // Sheets styles (kept largely the same)
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sheetHeaderSpacer: {
    width: 64,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.quinaryColor,
  },
  sheetSectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  sheetParagraph: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    marginBottom: 12,
  },
  sheetListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: '#E8F5E8',
    borderColor: Colors.verusGreenColor,
  },
  optionCardBest: {
    backgroundColor: '#F0FFF0',
  },
  optionMain: {
    flex: 1,
    paddingRight: 10,
  },
  optionInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#D4EDDA',
    borderRadius: 4,
  },
  bestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.verusGreenColor,
    letterSpacing: 0.5,
  },
});

