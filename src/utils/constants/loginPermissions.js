// Login permission types constants
export const LOGIN_PERMISSION_TYPES = {
  DOWNLOAD_REQUIRED: 'downloadRequired',
  VIEW_ATTESTATION: 'viewAttestation', 
  ATTESTATION_TO_ACCEPT: 'attestationToAccept',
  OPEN_PROFILE: 'openProfile',
  SIGN_MESSAGE: 'signmessage'
};

// Permission action descriptions
export const LOGIN_PERMISSION_ACTIONS = {
  [LOGIN_PERMISSION_TYPES.DOWNLOAD_REQUIRED]: 'download attestation',
  [LOGIN_PERMISSION_TYPES.VIEW_ATTESTATION]: 'view attestation',
  [LOGIN_PERMISSION_TYPES.ATTESTATION_TO_ACCEPT]: 'accept attestation',
  [LOGIN_PERMISSION_TYPES.OPEN_PROFILE]: 'access profile data',
  [LOGIN_PERMISSION_TYPES.SIGN_MESSAGE]: 'sign message'
};

// Permission status constants
export const PERMISSION_STATUS = {
  PENDING: 'pending',
  AGREED: 'agreed',
  REJECTED: 'rejected'
};