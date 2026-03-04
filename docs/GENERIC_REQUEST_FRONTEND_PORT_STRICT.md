# Strict Port List: Generic Request Frontend Design

## Scope
- Baseline target branch: `VerusCoin/Verus-Mobile@generic-request-changes` (`bdfab92`)
- This is the trimmed file set to port the updated frontend design for:
  - Authentication request UI
  - VerusPay invoice request UI
  - Identity update request stepper UI
  - Generic request completion UI

## Must Port: Screen Files
- `src/containers/DeepLink/AuthenticationRequestInfo/AuthenticationRequestInfo.js`
- `src/containers/DeepLink/AuthenticationRequestInfo/components/IdentityPickerSheet.js`
- `src/containers/DeepLink/InvoiceInfo/InvoiceInfo.js`
- `src/containers/DeepLink/GenericRequestComplete/GenericRequestComplete.js`
- `src/containers/DeepLink/IdentityUpdateRequestInfo/IdentityUpdateRequestInfo.js`
- `src/containers/DeepLink/IdentityUpdateRequestInfo/components/AuthorityInfoSheet.js`
- `src/containers/DeepLink/IdentityUpdateRequestInfo/steps/ReviewStep.js`
- `src/containers/DeepLink/IdentityUpdateRequestInfo/steps/ContentStep.js`
- `src/containers/DeepLink/IdentityUpdateRequestInfo/steps/HighRiskStep.js`
- `src/containers/DeepLink/IdentityUpdateRequestInfo/steps/ConfirmPayStep.js`
- `src/containers/DeepLink/IdentityUpdateRequestInfo/utils/classifyChanges.js`

## Must Port: Shared UI Components Used by Those Screens
- `src/components/GradientButton.js`
- `src/components/VerusIdObjectData.js`
- `src/components/VerusIdDetailsModal/VerusIdDetailsModal.js`
- `src/components/VdxfUniValueModal/VdxfUniValueModal.render.js`
- `src/components/ListSelectionModal/ListSelectionModal.js`
- `src/components/SemiModal.js`

## Wiring Guidance (Important)
- For a strict UI-only PR, do **not** port your current versions of:
  - `src/containers/DeepLink/GenericRequestHome/GenericRequestHome.js`
  - `src/containers/RootStack/DeepLinkStackScreens/DeepLinkStackScreens.js`
  - `src/containers/DeepLink/DeepLink.js`
- Reason: in your branch those files include non-UI additions (DataPacket and extra attestation/login routes).
- `generic-request-changes` already has working wiring for auth/veruspay/identity-update generic-request flow.

## Optional (Only If You Also Want These UX Areas)
- Login consent redesign:
  - `src/containers/DeepLink/LoginRequestInfo/LoginRequestInfo.js`
  - `src/containers/DeepLink/LoginRequestIdentity/LoginRequestIdentity.js`
  - `src/containers/DeepLink/LoginRequestComplete/LoginRequestComplete.js`
- Data packet request UI:
  - `src/containers/DeepLink/DataPacketRequestInfo/DataPacketRequestInfo.js`
  - `src/components/DataDescriptorList/DataDescriptorList.js`
  - `src/components/DataDescriptorList/index.js`
  - plus related wiring/handler updates
    - `src/containers/DeepLink/GenericRequestHome/GenericRequestHome.js`
    - `src/utils/deeplink/handlers/dataPacketRequestDetailsHandler.js`
    - `src/utils/deeplink/validator/dataPacketRequestValidator.js`

## Practical Port Order
1. Port shared UI components.
2. Port target DeepLink screen files.
3. Keep baseline wiring from `generic-request-changes` unchanged.
4. Run app and validate auth/veruspay/identity-update request screens end-to-end.
