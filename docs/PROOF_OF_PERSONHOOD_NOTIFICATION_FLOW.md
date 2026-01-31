# Proof of Personhood (PoP) Notification Flow

## Overview

This document describes the implementation of the Proof of Personhood notification system that alerts users when they become eligible for a PoP attestation after completing KYC verification through on-ramp or off-ramp transactions.

## Background

When users purchase or sell cryptocurrency over $1000 through the Valu on-ramp/off-ramp service, they are required to complete KYC (Know Your Customer) verification via Paybis, which uses Sumsub as their KYC provider. Upon successful KYC completion, users become eligible to claim a "Proof of Personhood" attestation from Valu.

## User Flow

```
1. User initiates on-ramp (buy) or off-ramp (sell) transaction
   ↓
2. Transaction amount > $1000 triggers KYC requirement
   ↓
3. User completes KYC verification through Sumsub/Paybis webview
   ↓
4. Backend detects KYC completion and marks user as eligible
   ↓
5. App checks eligibility status after transaction
   ↓
6. If eligible AND user doesn't already have PoP:
   - Create in-app notification
   - Notification appears in notification center
   ↓
7. User taps notification
   ↓
8. Navigate to ValuAttestation screen to claim PoP
```

## Technical Implementation

### Frontend Components

#### 1. API Integration (`src/utils/services/`)

**ValuService.js**
- Added `checkPopEligibility()` method to call backend endpoint
- Endpoint: `POST /check-pop-eligibility`
- Payload: `{ requestId: string }` - The on/off-ramp transaction request ID

**ValuApi.js**
- Added wrapper method `checkPopEligibility()` to expose service method
- Handles authentication and request formatting

#### 2. Notification Helper (`src/utils/pop/popNotificationHelper.js`)

Core utility functions for managing PoP notifications:

##### `hasProofOfPersonhood()`
- Checks local attestation storage
- Returns `true` if user already has "Valu Proof of Personhood"
- Prevents duplicate notifications

##### `checkPopEligibility(requestId)`
- Calls backend API to check if user is eligible
- Returns: `{ eligible: boolean, kycPassed: boolean, message?: string }`

##### `createPopAvailableNotification(accountHash, navigationCallback)`
- Creates a `DeeplinkNotification` instance
- Title: "Proof of Personhood Available"
- Body: Explains user completed KYC and can claim PoP
- Icon: NOTIFICATION_ICON_VALU
- Dispatches notification to notification center

##### `checkAndNotifyPopEligibility(requestId, navigationCallback)`
- Main orchestration function
- Checks if user already has PoP
- Verifies KYC status with backend
- Creates notification if eligible
- Returns result with reason for success/failure

##### `createValuAttestationNavigationCallback(navigation)`
- Helper to create proper navigation callback
- Navigates to `ValuAttestation` screen when notification is tapped

#### 3. On-Ramp Integration (`ValuOnRampChooseSource.js`)

After opening the InAppBrowser for checkout:
```javascript
setTimeout(async () => {
  const navigationCallback = createValuAttestationNavigationCallback(this.props.navigation);
  const result = await checkAndNotifyPopEligibility(reply.requestId, navigationCallback);
  if (result.notificationCreated) {
    console.log('PoP notification created for user after on-ramp transaction');
  }
}, 5000); // Wait 5 seconds for transaction processing
```

#### 4. Off-Ramp Integration (`ValuOffRampChooseSource.js`)

Similar implementation after opening InAppBrowser:
```javascript
setTimeout(async () => {
  const navigationCallback = createValuAttestationNavigationCallback(this.props.navigation);
  const result = await checkAndNotifyPopEligibility(reply.requestId, navigationCallback);
  if (result.notificationCreated) {
    console.log('PoP notification created for user after off-ramp transaction');
  }
}, 5000);
```

### Backend Requirements

#### Endpoint: `/check-pop-eligibility`

**Request:**
```json
{
  "requestId": "string" // On-ramp or off-ramp transaction request ID
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eligible": boolean,
    "kycPassed": boolean,
    "message": "string (optional)"
  }
}
```

**Logic:**
1. Look up transaction by `requestId`
2. Check if transaction triggered KYC verification
3. Query Sumsub/Paybis for KYC status
4. Determine if user is eligible for PoP:
   - KYC verification must be completed successfully
   - User must not already have PoP attestation
   - Transaction must meet minimum threshold ($1000+)
5. Return eligibility status

#### Sumsub Integration

The backend should:
1. Receive webhooks from Sumsub when KYC verification completes
2. Store KYC status associated with user's `partnerUserId`
3. Track which users have completed KYC
4. Provide this data via the `/check-pop-eligibility` endpoint

## Notification Behavior

### When Notification is Created
- User completes on/off-ramp transaction
- KYC verification is passed
- User does NOT already have PoP attestation
- Notification appears immediately in notification center

### When Notification is NOT Created
- User already has PoP attestation (`already_has_pop`)
- KYC not completed (`kyc_not_passed`)
- User not eligible (`not_eligible`)
- No active account (`no_active_account`)
- API error (`error`)

### Notification Appearance

**Title:** "Proof of Personhood Available"

**Body:** "You've completed KYC verification and are now eligible to claim your Proof of Personhood attestation. Tap here to get started."

**Icon:** Valu service icon

**Type:** DeeplinkNotification (actionable)

### User Interaction

1. User sees notification badge in app
2. Opens notification center
3. Taps "Proof of Personhood Available" notification
4. App navigates to `ValuAttestation` screen
5. User follows attestation flow to claim PoP

## Edge Cases & Considerations

### Timing
- 5-second delay before checking eligibility allows:
  - Transaction to be processed by backend
  - KYC webhook to be received
  - Database to be updated with KYC status

### Duplicate Prevention
- Always checks local attestation storage first
- Backend should also prevent duplicate PoP issuance

### Network Failures
- Errors are logged but don't block user flow
- User can manually navigate to attestation if notification fails
- Can be retried on next app launch or transaction

### Multiple Transactions
- Each transaction triggers a check
- Only one notification created (due to "already has PoP" check)
- Idempotent operation

### Offline Behavior
- Check will fail silently if offline
- Can be retried when connection restored
- Backend maintains eligibility status

## Testing Checklist

### Frontend Tests
- [ ] Import paths resolve correctly
- [ ] Navigation callback functions properly
- [ ] Notification appears in notification center
- [ ] Tapping notification navigates to ValuAttestation
- [ ] No notification if user already has PoP
- [ ] Handles API errors gracefully

### Backend Tests
- [ ] Endpoint returns correct eligibility for completed KYC
- [ ] Endpoint returns `kycPassed: false` for incomplete KYC
- [ ] Endpoint returns `eligible: false` if user has PoP
- [ ] Handles invalid requestId
- [ ] Sumsub webhook integration works
- [ ] Transaction tracking is accurate

### Integration Tests
- [ ] Complete on-ramp transaction over $1000
- [ ] Complete KYC in Sumsub flow
- [ ] Notification appears after returning to app
- [ ] Tapping notification navigates correctly
- [ ] Complete off-ramp transaction over $1000
- [ ] Same notification behavior as on-ramp
- [ ] No duplicate notifications on subsequent transactions

## Future Enhancements

1. **Push Notifications**: Send push notification when PoP becomes available
2. **Batch Checking**: Check eligibility for all recent transactions on app launch
3. **Notification Expiry**: Auto-dismiss after PoP is claimed
4. **Deep Link**: Support direct deep link to PoP claim flow
5. **Analytics**: Track notification creation, tap rate, and conversion to PoP claim

## Troubleshooting

### Notification Not Appearing
1. Check console logs for errors
2. Verify backend endpoint is reachable
3. Confirm requestId is valid
4. Check if user already has PoP
5. Verify KYC status in backend

### Navigation Not Working
1. Verify navigation object is available
2. Check route name matches navigation stack
3. Ensure ValuAttestation screen is registered

### Backend Issues
1. Check Sumsub webhook configuration
2. Verify API authentication
3. Review transaction lookup logic
4. Confirm KYC status storage

## Related Files

- `src/utils/services/ValuService.js`
- `src/utils/services/ValuApi.js`
- `src/utils/pop/popNotificationHelper.js`
- `src/containers/Services/ServiceComponents/ValuService/ValuOnRamp/ValuOnRampChooseSource.js`
- `src/containers/Services/ServiceComponents/ValuService/ValuOffRamp/ValuOffRampChooseSource.js`
- `src/containers/Services/ServiceComponents/ValuService/ValuAttestation/ValuAttestation.js`
- `src/utils/notification.js`

## Support Contacts

For issues or questions:
- Frontend: Contact mobile app team
- Backend: Contact Valu service team
- KYC Integration: Contact Paybis/Sumsub team
