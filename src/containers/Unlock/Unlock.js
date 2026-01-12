/*
  Unlock screen (iterated):
  - Aligns CTA styling with the rest of the app by reusing `GradientButton` (matching the prior `Login` screen buttons).
  - Reuses the existing CreateProfile password input styling pattern (custom RN TextInput w/ focus border + soft background).
  - Restyles Switch/Forgot sheets to match `TransferSheet` conventions (header spacing, safe-area padding, card-like list rows).
  - Keeps auto biometrics, default-profile priority, and top-right "Powered by Verus" + "More" affordances.
  - Sets the keyboard action key to "Go" on the password field to better match the unlock intent.
  - Adds immediate unlock feedback: inline loading state + spinner inside the Unlock button.
  - Adds the slow-motion onboarding gradient video as a background (matching `Login.js`) for brand continuity.
*/
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
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
import Video from 'react-native-video';
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
import {saveGeneralSettings} from '../../actions/actionCreators';

const BIOMETRIC_PROMPT = 'Authenticate to unlock profile';
const onboardingVideo = require('../../images/valu-onb-video1.mp4');

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

  const defaultAccountHash = useSelector(
    state => state.settings.generalWalletSettings.defaultAccount,
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

  const isFaceBiometry = useMemo(() => {
    const name = supportedBiometryType?.display_name ?? '';
    return /face/i.test(name);
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
      setLoading(true);
      clearErrors();
      Keyboard.dismiss();

      try {
        // We do not change default here; selection follows the persisted default account.
        await initializeAccountData(selectedAccount, key, false);
      } catch (e) {
        setErrorText('Incorrect password. Try again.');
      } finally {
        setLoading(false);
      }
    },
    [selectedAccount, clearErrors],
  );

  const tryAutoBiometricUnlock = useCallback(async () => {
    if (!selectedAccount?.biometry) return;

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
      await tryAutoBiometricUnlock();
      return;
    }

    setEnableBiometricsInfoVisible(true);
  }, [selectedAccount, tryAutoBiometricUnlock]);

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
    if (switchSheetVisible || forgotSheetVisible || enableBiometricsInfoVisible)
      return;
    tryAutoBiometricUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAccount?.accountHash,
    switchSheetVisible,
    forgotSheetVisible,
    enableBiometricsInfoVisible,
  ]);

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
      {/* Background video (slow motion gradient) */}
      <Video
        source={onboardingVideo}
        style={styles.video}
        resizeMode="cover"
        repeat
        muted
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="obey"
      />
      {/* No scrim: allow the slow-motion video background to read fully. */}

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
              // Leave space for fixed bottom CTAs
              {paddingBottom: Math.max(insets.bottom, 16) + 160},
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.unlockPanel}>
              {/* Profile section */}
              <View style={styles.panelSection}>
                <View style={styles.profileRow}>
                  <View style={styles.profileTextWrap}>
                    <View style={styles.profileNameRow}>
                      <MaterialCommunityIcons
                        name="account-circle-outline"
                        size={22}
                        color="#1A1A1A"
                        style={{marginRight: 8}}
                      />
                      <Text style={styles.profileName} numberOfLines={1}>
                        {selectedAccount?.id ?? ''}
                      </Text>
                    </View>
                    {defaultAccount?.accountHash ===
                      selectedAccount?.accountHash && (
                      <View style={styles.defaultPill}>
                        <Text style={styles.defaultPillText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setSwitchSheetVisible(true)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Switch profile"
                    style={styles.switchInline}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  >
                    <MaterialCommunityIcons
                      name="account-switch"
                      size={20}
                      color={Colors.verusDarkGray}
                    />
                    <Text style={styles.switchInlineText}>{'Switch'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password section */}
              <View style={[styles.panelSection, styles.panelSectionAfterProfile]}>

                <View style={styles.passwordRow}>
                  <View style={{flex: 1, position: 'relative'}}>
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
                      style={[
                        styles.passwordInput,
                        passwordFocused ? styles.passwordInputFocused : null,
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => setPasswordVisible(v => !v)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={
                        passwordVisible ? 'Hide password' : 'Show password'
                      }
                      style={styles.passwordEye}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    >
                      <MaterialCommunityIcons
                        name={passwordVisible ? 'eye-off' : 'eye'}
                        size={20}
                        color={'#111'}
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handlePressBiometrics}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Use biometrics"
                    style={styles.bioIconOnly}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  >
                    {isFaceBiometry ? (
                      <FaceRecognitionIcon
                        width={24}
                        height={24}
                        fill={
                          selectedAccount?.biometry
                            ? Colors.verusDarkGray
                            : '#B8B8B8'
                        }
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="fingerprint"
                        size={24}
                        color={
                          selectedAccount?.biometry
                            ? Colors.verusDarkGray
                            : '#B8B8B8'
                        }
                      />
                    )}
                  </TouchableOpacity>
                </View>

                {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

                <View style={styles.linksRow}>
                  <TouchableOpacity
                    onPress={() => setForgotSheetVisible(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Text style={styles.linkTextNeutral}>
                      Forgot your password?
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>

      {/* Fixed bottom CTAs (like `Login.js`) */}
      <View
        pointerEvents="box-none"
        style={[
          styles.bottomCtas,
          {bottom: Math.max(insets.bottom, 16) + 20},
        ]}
      >
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

        <GradientButton
          onPress={handleCreateProfile}
          mode="outlined"
          labelStyle={styles.createButtonLabel}
          style={styles.createButton}
        >
          {'Create new profile'}
        </GradientButton>
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
                onPress={() => setForgotSheetVisible(false)}
                textColor={Colors.primaryColor}
              >
                Close
              </Button>
              <Text style={styles.sheetTitle}>Forgot password</Text>
              <View style={styles.sheetHeaderSpacer} />
            </View>

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
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  // No scrim: the video is intentionally vivid; keep foreground legible via the panel styling instead.
  videoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0)',
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
    paddingTop: 140,
    paddingHorizontal: 20,
  },
  headerBlock: {
    marginBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.quinaryColor,
    letterSpacing: -0.3,
  },
  unlockPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 10},
    elevation: 3,
  },
  panelSection: {
    paddingVertical: 14,
  },
  panelSectionAfterProfile: {
    paddingTop: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: 'black',
  },
  defaultPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF3F7',
  },
  defaultPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A4A4A',
    letterSpacing: 0.2,
  },
  switchInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  switchInlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.verusDarkGray,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passwordInput: {
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E2E2',
    paddingHorizontal: 16,
    paddingRight: 46,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#FBFBFB',
  },
  passwordInputFocused: {
    borderColor: Colors.primaryColor,
  },
  passwordEye: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  bioIconOnly: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 8,
    color: Colors.warningButtonColor,
    fontSize: 13,
    lineHeight: 18,
  },
  linksRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  linkText: {
    color: Colors.primaryColor,
    fontWeight: '600',
  },
  linkTextNeutral: {
    color: Colors.verusDarkGray,
    fontWeight: '600',
  },
  biometricsButton: {
    marginTop: 12,
    height: 46,
  },
  bottomCtas: {
    position: 'absolute',
    left: 20,
    right: 20,
    gap: 10,
  },
  unlockButton: {
    marginTop: 6,
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
    letterSpacing: 0,
  },
  createButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  createButtonLabel: {
    color: Colors.primaryColor,
    fontWeight: '600',
    fontSize: 16,
    textShadowColor: 'transparent',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 0,
  },
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
  sheetItemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    paddingVertical: 8,
  },
  sheetItemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'black',
  },
  sheetItemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
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

  // Switch profile cards (SendViaSheet-inspired)
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

