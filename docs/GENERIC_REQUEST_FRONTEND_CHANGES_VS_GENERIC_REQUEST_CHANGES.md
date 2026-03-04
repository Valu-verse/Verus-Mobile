# Generic Request Frontend Changes vs `generic-request-changes`

## Baseline
- Compared local repo `/Users/maxtheyse/dev/valu-mobile` against:
  - Remote: `https://github.com/VerusCoin/Verus-Mobile`
  - Branch: `generic-request-changes`
  - Commit: `bdfab92`
- Goal of this doc: list frontend/design changes made on top of that branch.

## Core DeepLink UI Changes
- `src/containers/DeepLink/AuthenticationRequestInfo/AuthenticationRequestInfo.js` (modified)
- `src/containers/DeepLink/AuthenticationRequestInfo/components/IdentityPickerSheet.js` (added)
- `src/containers/DeepLink/GenericRequestComplete/GenericRequestComplete.js` (modified)
- `src/containers/DeepLink/GenericRequestHome/GenericRequestHome.js` (modified)
- `src/containers/DeepLink/DeepLink.js` (modified)
- `src/containers/DeepLink/InvoiceInfo/InvoiceInfo.js` (modified)
- `src/containers/DeepLink/IdentityUpdateRequestInfo/IdentityUpdateRequestInfo.js` (modified; refactor to stepper)
- `src/containers/DeepLink/IdentityUpdateRequestInfo/components/AuthorityInfoSheet.js` (added)
- `src/containers/DeepLink/IdentityUpdateRequestInfo/steps/ReviewStep.js` (added)
- `src/containers/DeepLink/IdentityUpdateRequestInfo/steps/ContentStep.js` (added)
- `src/containers/DeepLink/IdentityUpdateRequestInfo/steps/HighRiskStep.js` (added)
- `src/containers/DeepLink/IdentityUpdateRequestInfo/steps/ConfirmPayStep.js` (added)
- `src/containers/DeepLink/IdentityUpdateRequestInfo/utils/classifyChanges.js` (added)

## Additional DeepLink UX Additions
- `src/containers/DeepLink/DataPacketRequestInfo/DataPacketRequestInfo.js` (added)
- `src/containers/DeepLink/LoginRequestInfo/LoginRequestInfo.js` (modified)
- `src/containers/DeepLink/LoginRequestIdentity/LoginRequestIdentity.js` (modified)
- `src/containers/DeepLink/LoginRequestComplete/LoginRequestComplete.js` (modified)
- `src/containers/DeepLink/LoginReceiveAttestation/LoginReceiveAttestation.js` (added)
- `src/containers/DeepLink/LoginReceiveAttestation/LoginReceiveAttestation.render.js` (added)
- `src/containers/DeepLink/LoginShareAttestation/LoginShareAttestation.js` (added)
- `src/containers/DeepLink/LoginShareAttestation/LoginShareAttestation.render.js` (added)
- `src/containers/DeepLink/LoginSignDataRequest/LoginSignDataRequest.js` (added)
- `src/containers/DeepLink/LoginSignDataRequest/LoginSignDataRequest.render.js` (added)
- `src/containers/DeepLink/LoginSignDataRequest/index.js` (added)
- `src/containers/DeepLink/PersonalSelectData/PersonalSelectData.js` (added)
- `src/containers/DeepLink/PersonalSelectData/PersonalSelectData.render.js` (added)

## Shared UI Components Changed for the Redesign
- `src/components/GradientButton.js` (added)
- `src/components/VerusIdObjectData.js` (modified)
- `src/components/VerusIdDetailsModal/VerusIdDetailsModal.js` (modified)
- `src/components/VdxfUniValueModal/VdxfUniValueModal.render.js` (modified)
- `src/components/ListSelectionModal/ListSelectionModal.js` (modified)
- `src/components/SemiModal.js` (modified)
- `src/components/DataDescriptorList/DataDescriptorList.js` (added)
- `src/components/DataDescriptorList/index.js` (added)

## Navigation/Wiring Files Touched (to expose UI)
- `src/containers/RootStack/DeepLinkStackScreens/DeepLinkStackScreens.js` (modified)

## Notes
- This list is frontend/design focused.
- There are also backend/plumbing changes in the same comparison (validators, handlers, request parsing/signing), but those are intentionally not expanded in this doc.
