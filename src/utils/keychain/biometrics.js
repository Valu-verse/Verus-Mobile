/*
  Biometrics - Platform-specific biometric password storage.
  - 2026-01-31: Added defensive check in storeBiometricPassword() to prevent vault overwrite
    when the in-memory flag is stale but a vault already exists in storage. This fixes the issue
    where enabling biometrics for multiple profiles in the same session could overwrite the vault
    and invalidate earlier profiles.
*/
import { Platform } from "react-native";
import { generateBiometricCredential, getLegacyBiometricData, getLegacyBiometricPassword, removeAllLegacyBiometricPasswords, removeLegacyBiometricPassword, storeLegacyBiometricPassword } from "./keychain"
import { SecureStorage } from "./secureStore"

// We continue to use "legacy" biometric storage on iOS devices because the reason to migrate to a model where 
// an encrypted 'vault' is stored in async storage while its encryption key is stored in the biometric keychain
// was necessary due to a limitation on keychain size in Android. If limitations occur on iOS, iOS can be migrated
// by simply deleting the Platform.OS exceptions in the functions below.

export const getBiometricPassword = async (accountHash, title) => {
  if (Platform.OS === "ios") return getLegacyBiometricPassword(accountHash, title);

  // Sync flag from storage in case it's stale (e.g., vault was created earlier in this session)
  await SecureStorage.syncBiometryFlagFromStorage();

  if (SecureStorage.biometryFlagSet()) {
    return SecureStorage.getPasswordFromBiometricVault(accountHash);
  } else {
    // Attempt to migrate data to secure store while also fetching biometric password if data is stored in legacy 
    // keychain format
    const allBiometricDataJson = await getLegacyBiometricData(title);
    const password = allBiometricDataJson[accountHash];

    try {
      await generateBiometricCredential();
      await SecureStorage.setBiometricVaultData(allBiometricDataJson);
      await removeAllLegacyBiometricPasswords();
    } catch(e) {
      console.log("Error migrating biometric passwords to secure store:");
      console.log(e);
    }

    return password;
  }
}

export const storeBiometricPassword = async (accountHash, password) => {
  if (Platform.OS === "ios") return storeLegacyBiometricPassword(accountHash, password);

  // Defensive check: sync flag from storage in case a vault already exists but the in-memory
  // flag is stale. This prevents generating a new credential and overwriting the vault.
  await SecureStorage.syncBiometryFlagFromStorage();

  if (!SecureStorage.biometryFlagSet()) {
    // No vault exists; create new credential and vault
    await generateBiometricCredential();
    await SecureStorage.setBiometricVaultData({ [accountHash]: password });
  } else {
    // Vault exists; add/update this account's password in the existing vault
    return SecureStorage.setPasswordInBiometricVault(accountHash, password);
  }
}

export const removeBiometricPassword = async (accountHash) => {
  if (Platform.OS === "ios") return removeLegacyBiometricPassword(accountHash);

  // Sync flag from storage in case it's stale
  await SecureStorage.syncBiometryFlagFromStorage();

  if (SecureStorage.biometryFlagSet()) {
    return SecureStorage.removePasswordFromBiometricVault(accountHash);
  } else {
    return removeLegacyBiometricPassword(accountHash);
  }
}