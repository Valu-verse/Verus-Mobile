/**
 * Proof of Personhood (PoP) Notification Helper
 * 
 * This utility handles the flow of checking if a user is eligible for a Proof of Personhood
 * attestation after completing KYC through on/off-ramp transactions, and creates appropriate
 * notifications to guide them to claim their PoP.
 * 
 * Flow:
 * 1. User completes on/off-ramp transaction over $1000 (triggers KYC via Paybis/Sumsub)
 * 2. Backend detects KYC completion and user's eligibility status
 * 3. App checks PoP eligibility after transaction
 * 4. If eligible and doesn't have PoP yet, create notification
 * 5. User taps notification → navigates to ValuAttestation screen
 */

import Store from "../../store";
import ValuProvider from "../services/ValuProvider";
import { NavigationNotification } from "../notification";
import { dispatchAddNotification } from "../../actions/actions/notifications/dispatchers/notifications";
import { NOTIFICATION_ICON_VALU } from "../constants/notifications";
import { requestAttestationData } from "../auth/authBox";
import { ATTESTATIONS_PROVISIONED } from "../constants/attestations";
import { coinsList } from "../CoinData/CoinsList";
import { VRPC } from "../constants/intervalConstants";

/**
 * Check if user already has a Proof of Personhood attestation
 * @returns {Promise<boolean>} True if user has PoP, false otherwise
 */
export const hasProofOfPersonhood = async () => {
  try {
    const attestationData = await requestAttestationData(ATTESTATIONS_PROVISIONED);
    
    if (!attestationData || Object.keys(attestationData).length === 0) {
      return false;
    }
    
    // attestationData is an object with attestation IDs as keys
    // Convert to array of attestation values
    const attestations = Object.values(attestationData);
    
    if (attestations.length === 0) {
      return false;
    }
    
    // Check if any attestation is a "Valu Proof of Personhood"
    const hasPoP = attestations.some(
      (attestationItem) => attestationItem.name === "Valu Proof of Personhood"
    );

    return hasPoP;
  } catch (error) {
    console.error("❌ Error checking for existing Proof of Personhood:", error);
    return false;
  }
};

/**
 * Check with backend if user is eligible for PoP after completing KYC
 * Backend uses the x-api-key header to identify the user and check Paybis KYC status
 * @param {string} partnerUserId - The partner user ID for the authenticated user
 * @returns {Promise<{eligible: boolean, kycPassed: boolean, message?: string}>}
 */
export const checkPopEligibility = async (partnerUserId) => {
  try {
    const activeAccount = Store.getState().authentication.activeAccount;
    
    // Get the primary VRSC address
    let primaryAddress = null;
    const vrscKeys = activeAccount?.keys?.[coinsList.VRSC.id];
    
    if (vrscKeys) {
      // Find the VRPC channel and get the first address
      for (const channelId in vrscKeys) {
        const [channelName] = channelId.split('.');
        if (channelName === VRPC && vrscKeys[channelId]?.addresses?.length > 0) {
          primaryAddress = vrscKeys[channelId].addresses[0];
          break;
        }
      }
    }
    
    const response = await ValuProvider.checkPopEligibility({ 
      partnerUserId,
      primaryAddress 
    });
    
    if (response.success) {
      return {
        eligible: response.data.eligible || false,
        kycPassed: response.data.kycPassed || false,
        message: response.data.message
      };
    }
    
    return { eligible: false, kycPassed: false };
  } catch (error) {
    console.error("Error checking PoP eligibility:", error);
    return { eligible: false, kycPassed: false };
  }
};

/**
 * Create and dispatch a notification to inform user about available PoP
 * @param {string} accountHash - The account hash for the notification
 * @param {function} navigationCallback - Callback to navigate to GetSponsoredAttestation screen
 */
export const createPopAvailableNotification = (accountHash, navigationCallback) => {
  const navigationData = {
    screen: 'GetSponsoredAttestation',
    type: 'pop_available' // Identifier to recreate the callback
  };

  const notification = new NavigationNotification(
    "You've completed KYC verification and are now eligible to claim your Proof of Personhood attestation. Tap here to get started.",
    "Proof of Personhood Available",
    navigationCallback,
    null, // uid - will be auto-generated
    accountHash,
    navigationData // Store navigation metadata for persistence
  );

  notification.icon = NOTIFICATION_ICON_VALU;
  
  dispatchAddNotification(notification);
  
  return notification;
};

/**
 * Main flow: Check PoP eligibility and create notification if appropriate
 * This should be called after user returns to app and Valu service is authenticated
 * 
 * @param {string} partnerUserId - The partner user ID for the authenticated user
 * @param {function} navigationCallback - Callback to navigate to ValuAttestation
 * @returns {Promise<{notificationCreated: boolean, reason?: string}>}
 */
export const checkAndNotifyPopEligibility = async (partnerUserId, navigationCallback) => {
  try {
    const activeAccount = Store.getState().authentication.activeAccount;
    const accountHash = activeAccount?.accountHash;

    if (!accountHash) {
      return { notificationCreated: false, reason: "no_active_account" };
    }

    // First check if user already has PoP
    const alreadyHasPoP = await hasProofOfPersonhood();
    
    if (alreadyHasPoP) {
      return { notificationCreated: false, reason: "already_has_pop" };
    }

    // Check eligibility with backend (backend uses API key to identify user)
    const eligibilityResult = await checkPopEligibility(partnerUserId);
    
    if (!eligibilityResult.kycPassed) {
      return { notificationCreated: false, reason: "kyc_not_passed" };
    }

    if (!eligibilityResult.eligible) {
      return { notificationCreated: false, reason: "not_eligible" };
    }

    // User is eligible and doesn't have PoP - create notification
    createPopAvailableNotification(accountHash, navigationCallback);
    
    return { notificationCreated: true };

  } catch (error) {
    console.error("Error in checkAndNotifyPopEligibility:", error);
    return { notificationCreated: false, reason: "error", error: error.message };
  }
};

/**
 * Helper to create navigation callback for ValuAttestation screen
 * @param {object} navigation - React Navigation navigation object
 * @returns {function} Navigation callback
 */
export const createValuAttestationNavigationCallback = (navigation) => {
  return () => {
    if (navigation && navigation.navigate) {
      navigation.navigate('ValuAttestation');
    }
  };
};

/**
 * Helper to create navigation callback for GetSponsoredAttestation screen
 * This is used for users who are eligible for PoP after on/off-ramp KYC completion
 * @param {object} navigation - React Navigation navigation object
 * @returns {function} Navigation callback
 */
export const createGetSponsoredAttestationNavigationCallback = (navigation) => {
  return async () => {
    if (!navigation || !navigation.navigate) {
      return;
    }
    
    // FIRST: Check if user already has the attestation in local storage
    const alreadyHasPoP = await hasProofOfPersonhood();
    
    if (alreadyHasPoP) {
      // User already has PoP - navigate directly to attestations list
      navigation.navigate('Home', {
        screen: 'ServicesHome',
        params: {
          screen: 'Service',
          params: {
            service: 'attestation_service'
          }
        }
      });
      return;
    }
    
    // User doesn't have PoP yet - proceed to GetSponsoredAttestation screen
    navigation.navigate('Home', {
      screen: 'ServicesHome',
      params: {
        screen: 'GetSponsoredAttestation'
      }
    });
  };
};
