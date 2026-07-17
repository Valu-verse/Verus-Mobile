# USDC → vUSDC Bridge: Mobile App Implementation Guide

> Hand this document to your mobile-app AI as its primary specification for
> building the USDC-to-vUSDC swap feature.

---

## Overview

The server exposes a set of REST endpoints that let the mobile app convert a
user's USDC (held on Ethereum or Polygon Amoy) into vUSDC on the Verus
blockchain. The flow mirrors a service like Changelly:

1. **Detect** USDC in the user's EVM wallet (background watcher).
2. **Notify** the user and offer to bridge it.
3. **Initiate** the conversion – server records it and returns a `conversionId`.
4. **Send** – app builds and submits the EVM USDC transfer on behalf of the user.
5. **Track** – app polls the status endpoint until the conversion is final.
6. **Complete** – app shows success screen with the Verus txid.

---

## Network / Token Mapping

| Server mode (`PAYBIS_ENVIRONMENT`) | User sends          | User receives        |
|------------------------------------|---------------------|----------------------|
| `production`                       | USDC on **Ethereum**     | **vUSDC.vETH** on Verus mainnet (VRSC) |
| anything else                      | USDC on **Polygon Amoy** | **vUSDC** on Verus testnet (VRSCTEST) |

Call `GET /onramp/usdc-to-verus/deposit-info` at startup (or on first use) to
discover the active network and contract address — **do not hard-code them**.

---

## Authentication

All endpoints require the standard Valu HMAC-signature headers:

```
x-api-key: <userApiKey>
x-api-signature: HMAC-SHA256(<userSecret>, <method>://<host><path>[body])
```

---

## Endpoints

### 1 · Get deposit info
```
GET /onramp/usdc-to-verus/deposit-info
```
Call once at app startup to determine the active network and USDC contract.

**Response**
```json
{
  "success": true,
  "data": {
    "network": "polygon_amoy",
    "usdcContractAddress": "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    "verusCurrency": "vUSDC",
    "verusChain": "VRSCTEST (testnet)",
    "note": "Send USDC to uniquePaymentAddress returned by POST /onramp/initiate-usdc-to-verus"
  }
}
```

---

### 2 · Initiate a conversion
```
POST /onramp/initiate-usdc-to-verus
Content-Type: application/json
```

Call this **before** submitting the EVM transaction so the server is ready to
monitor the deposit address.

**Request body**
```json
{
  "sendingAddress":      "0xUserEVMAddress",
  "verusPaymentAddress": "RUserVerusRAddress",
  "uniquePaymentAddress":"0xBridgeDepositAddress",
  "amount":              "50.00"
}
```

| Field                  | Required | Description |
|------------------------|----------|-------------|
| `sendingAddress`       | ✓ | The user's Ethereum / Polygon Amoy address (EIP-55 checksum). |
| `verusPaymentAddress`  | ✓ | The user's Verus R-address or i-address where vUSDC will arrive. |
| `uniquePaymentAddress` | ✓ | The bridge deposit address the user will send USDC *to*. Must be an EVM address. |
| `amount`               | ✗ | USDC amount as a string (helps the poller verify full receipt). |
| `network`              | ✗ | Override the network (dev/testing only). Omit in production. |

> **Where does `uniquePaymentAddress` come from?**  
> This is the EVM address the Verus bridge (or a server-controlled wallet)
> monitors for incoming USDC. Obtain it from your Verus bridge integration or
> from a separate server endpoint. The Valu server will monitor this address
> and send vUSDC once funds arrive.

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "status": "PENDING",
    "statusLabel": "Waiting for USDC",
    "isFinal": false,
    "network": "polygon_amoy",
    "sendingAddress": "0xUserEVMAddress",
    "uniquePaymentAddress": "0xBridgeDepositAddress",
    "verusPaymentAddress": "RUserVerusRAddress",
    "amount": "50.00",
    "verusPayoutTxid": null,
    "createdAt": "2026-07-17T10:00:00.000Z"
  }
}
```

Store `id` as the `conversionId` – all subsequent polling uses it.

---

### 3 · Check conversion status
```
GET /onramp/usdc-to-verus/status/:conversionId
```

Poll this endpoint to drive the in-progress UI.

**Response**
```json
{
  "success": true,
  "data": {
    "id": "xxxxxxxx-...",
    "status": "VERUS_PAID",
    "statusLabel": "Complete",
    "isFinal": true,
    "canRetry": false,
    "verusPayoutTxid": "abc123verus...",
    "usdcDetectedAt": "2026-07-17T10:01:15.000Z",
    "updatedAt":      "2026-07-17T10:01:45.000Z"
  }
}
```

---

### 4 · Active conversions
```
GET /onramp/usdc-to-verus/active
```

Returns all PENDING / PROCESSING conversions for the user.  
Use on app launch to restore any in-progress swap UI that may have been
dismissed.

---

### 5 · Conversion history
```
GET /onramp/usdc-to-verus/history
```

Returns the last 50 conversions (all statuses) for the user.  
Use for a "Swap history" screen.

---

## Status State Machine

```
PENDING ──► PROCESSING ──► VERUS_PAID   (success)
   │                            │
   └── (24 h elapsed) ──► TIMED_OUT     (manual review)
PROCESSING ──► PENDING          │        (transient error – auto-retry)
```

| Status       | `isFinal` | `canRetry` | Meaning |
|--------------|-----------|------------|---------|
| `PENDING`    | false     | false      | Registered; server is watching for USDC |
| `PROCESSING` | false     | false      | USDC detected; server is sending vUSDC |
| `VERUS_PAID` | true      | false      | vUSDC sent; `verusPayoutTxid` is set |
| `TIMED_OUT`  | true      | true       | No USDC received within 24 h |
| `FAILED`     | false     | true       | Transient error; will retry automatically |

---

## Mobile App Implementation

### Background USDC Watcher

```pseudocode
every 30 seconds (or on push notification):
  balance = evm.getUsdcBalance(user.evmAddress, depositInfo.usdcContractAddress)
  if balance > 0 and no active conversion for this amount:
    showNotification("You have {balance} USDC – tap to bridge to vUSDC")
```

- Use the ERC-20 `balanceOf(address)` function on `depositInfo.usdcContractAddress`.
- Cache the last-seen balance so the notification fires only on *new* USDC, not on every poll.
- Check `GET /onramp/usdc-to-verus/active` on app launch to suppress the notification if a conversion is already in progress.

### Full Conversion Flow

```
1.  Call GET /onramp/usdc-to-verus/deposit-info
    → save network, usdcContractAddress, verusCurrency

2.  User taps "Bridge X USDC to vUSDC"

3.  Call POST /onramp/initiate-usdc-to-verus
    → save conversionId from response

4.  Build EVM transaction:
      contract = ERC20(usdcContractAddress)
      tx = contract.transfer(uniquePaymentAddress, amountInUnits)   // 6 decimals
    Show the user the details (to, amount, estimated gas)
    User approves ► submit tx ► wait for 1 confirmation

5.  Show "Processing…" screen with:
      - Spinner
      - "Sending {amount} USDC to bridge…"
      - Option to "View on block explorer" (link to tx hash)

6.  Poll GET /onramp/usdc-to-verus/status/{conversionId} every 15 s:

    PENDING    → "Waiting for USDC confirmation…"
    PROCESSING → "Bridge detected your USDC – sending vUSDC to Verus…"
    VERUS_PAID → navigate to Success screen (step 7)
    TIMED_OUT  → show Timeout screen (step 8)
    FAILED     → show "Still processing – server will retry automatically"
                 continue polling

7.  Success screen:
      ✅ "Bridge complete!"
      "{amount} vUSDC sent to your Verus wallet"
      Verus txid (link to https://insight.verus.io/tx/{txid} or testnet explorer)
      "Back to Wallet" deep-link button

8.  Timeout screen:
      ⚠️ "Your conversion timed out"
      "No USDC was detected at the bridge address within 24 hours."
      Options:
        - "Check my USDC balance" → re-open watcher
        - "Contact support" → open email / chat
```

### Error Handling Rules

| Scenario | Behaviour |
|----------|-----------|
| Step 3 fails (network error) | Retry `initiate` up to 3 times with exponential back-off; if still failing, show "Service unavailable" |
| Step 4 EVM tx reverts | Do **not** proceed; show "Transaction failed – your USDC was not spent" |
| Step 4 EVM tx stuck (> 5 min) | Show "Still confirming on-chain…"; keep polling with a longer interval |
| Status `FAILED` | Continue polling; add "Retrying…" note; do **not** re-submit EVM tx |
| App backgrounded during step 6 | Re-check `active` on foreground; resume polling if still in progress |
| Status `TIMED_OUT` | Show timeout screen; offer retry (user must re-initiate **and** re-submit EVM tx) |

### Persistence / Crash Recovery

- Persist `conversionId` to local storage immediately after step 3.
- On every app launch, call `GET /onramp/usdc-to-verus/active`:
  - If any active records exist, restore the polling flow from step 6.
- On `VERUS_PAID` / `TIMED_OUT`, clear the persisted `conversionId`.

---

## Swap History Screen

Fetch `GET /onramp/usdc-to-verus/history` and display each record:

```
Date        Amount    Status       Action
──────────────────────────────────────────
Jul 17      50 USDC   ✅ Complete   View txid
Jul 16      25 USDC   ⚠️ Timed out  Retry
Jul 15     100 USDC   ✅ Complete   View txid
```

For rows with `canRetry: true` show a "Retry" button that starts a fresh
conversion flow (step 2 above) with the same amount.

---

## EVM Transaction Helper (pseudocode)

```javascript
const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

async function sendUsdcToBridge(provider, signer, usdcContractAddress, bridgeAddress, amountUsdc) {
  const contract = new ethers.Contract(usdcContractAddress, ERC20_ABI, signer);
  // USDC has 6 decimal places
  const amountUnits = ethers.parseUnits(amountUsdc.toString(), 6);
  const tx = await contract.transfer(bridgeAddress, amountUnits);
  await tx.wait(1); // wait for 1 block confirmation
  return tx.hash;
}
```

---

## Notification Copy

| Trigger | Title | Body |
|---------|-------|------|
| USDC detected in wallet | "USDC ready to bridge" | "You have {amount} USDC. Tap to convert it to vUSDC on Verus." |
| PROCESSING reached | "Bridge in progress" | "Your {amount} USDC has been received. Sending vUSDC to your wallet…" |
| VERUS_PAID | "Bridge complete 🎉" | "{amount} vUSDC has arrived in your Verus wallet." |
| TIMED_OUT | "Bridge timed out" | "Your conversion expired. Tap to retry." |
