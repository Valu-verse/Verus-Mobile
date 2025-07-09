# KYC Attestation Acceptance Feature

## Overview
This feature provides a user-friendly interface for accepting KYC (Know Your Customer) attestations after completing crypto purchase transactions through the Valu service. When users complete their onboarding registration with Paybis and pass KYC/AML verification, they receive a `sumsub shared token` that generates an attestation which can be accepted through this interface.

## Components

### 1. ValuAttestationAccept
**Location:** `src/containers/Services/ServiceComponents/ValuService/ValuAttestationAccept/`

A React component that displays:
- Transaction completion summary
- KYC verification details from the attestation
- Options to accept or ignore the attestation
- Explanatory text about the benefits of accepting the attestation

**Key Features:**
- Parses attestation data from VDXF format
- Handles both real and demo/mock attestation data
- Provides clear transaction summary
- Explains benefits of accepting attestation
- Graceful error handling for malformed data

### 2. Navigation Integration
The component is integrated into the Services navigation stack in:
`src/containers/RootStack/ServicesStackScreens/ServicesStackScreens.js`

## Usage Flow

1. **Transaction Completion**: User completes crypto purchase through Paybis
2. **KYC Verification**: User passes KYC/AML verification and receives sumsub shared token
3. **Attestation Creation**: Server creates attestation using the token data
4. **Deep Link/Navigation**: Mobile app receives attestation via deep link in loginrequest response
5. **Attestation Display**: `ValuAttestationAccept` component shows transaction summary and attestation details
6. **User Decision**: User can either:
   - **Accept**: Stores KYC credentials on blockchain for future use
   - **Ignore**: Dismisses attestation (can be accepted later from attestations list)

## Implementation Details

### Transaction Data Structure
```javascript
{
  amount: "100",           // Amount paid
  currency: "USD",         // Payment currency
  received: "99.50",       // Amount of vUSDC received
  address: "Address Name", // Receiving address name
  provider: "Paybis"       // Payment provider
}
```

### Attestation Data Structure
```javascript
{
  data: "hex_encoded_vdxf_data", // VDXF encoded attestation data
  signer: "Paybis KYC Provider"   // Attestation signer
}
```

### Navigation
To navigate to the attestation acceptance screen:
```javascript
this.props.navigation.navigate('ValuAttestationAccept', {
  attestation: attestationData,
  transactionData: transactionData
});
```

## Demo/Testing

A demo button has been added to the `ValuOnRampChooseSource` component for testing purposes:

**Demo Button**: "Demo: Test Attestation Flow"
- Creates mock transaction and attestation data
- Navigates directly to the attestation acceptance screen
- **Note**: This demo button should be removed in production

### Mock Data
The demo creates realistic mock data including:
- Full Name: "John Doe"
- Email: "john.doe@example.com"
- Country: "United States"
- KYC Status: "Verified"
- Verification Date: Current date

## Integration with Real Data

### Server-Side Requirements
1. **Sumsub Token Processing**: Server should use the sumsub shared token to retrieve user KYC data
2. **Attestation Creation**: Create VDXF-formatted attestation with verified user information
3. **Deep Link Generation**: Include attestation in loginrequest response as deep link

### Client-Side Integration
1. **Deep Link Handling**: Update deep link handlers to recognize attestation data
2. **Transaction Completion**: Call `handleTransactionComplete()` method with real attestation data
3. **Data Storage**: Implement actual attestation storage/acceptance logic in `processAcceptAttestation()`

## File Structure
```
src/containers/Services/ServiceComponents/ValuService/
├── ValuAttestationAccept/
│   ├── ValuAttestationAccept.js    # Main component
│   └── index.js                    # Export file
└── ValuOnRamp/
    └── ValuOnRampChooseSource.js   # Updated with demo and navigation methods
```

## Styling
The component uses React Native Paper components and follows the app's existing design patterns:
- Consistent color scheme using `Colors.primaryColor` and `Colors.verusGreenColor`
- Responsive layout with proper spacing
- Card-based layout for transaction and attestation information
- Clear call-to-action buttons

## Error Handling
- Graceful handling of malformed attestation data
- Fallback displays for missing information
- User-friendly error messages
- Proper loading states during processing

## Future Enhancements
1. **Persistent Storage**: Store accepted attestations locally
2. **Attestation History**: View previously accepted attestations
3. **Enhanced Verification**: Additional verification steps for high-value transactions
4. **Biometric Confirmation**: Add biometric authentication for attestation acceptance
5. **Offline Support**: Handle attestations when device is offline

## Security Considerations
- Attestation data is cryptographically signed
- No sensitive data stored in plain text
- Secure navigation between screens
- Proper validation of attestation format before processing
