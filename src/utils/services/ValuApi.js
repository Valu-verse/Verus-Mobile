import Store from "../../store";
import * as Keychain from 'react-native-keychain';
import { primitives } from "verusid-ts-client";
import { VALU_SERVICE_ID } from "../constants/services";
import { VRPC } from "../constants/intervalConstants";
import { AUTHENTICATE_VALU_SERVICE, DEAUTHENTICATE_VALU_SERVICE } from "../constants/storeType";
import { AccountBasedFintechApiTemplate } from "./ServiceTemplates";
import ValuService, { VALU_AUTH_CODES } from './ValuService'
import { coinsList } from '../CoinData/CoinsList'
import { signIdProvisioningRequest } from '../api/channels/vrpc/requests/signIdProvisioningRequest';
import { requestServiceStoredData } from '../auth/authBox';

// Keychain service name for one profile's v2 credentials on one network
const credentialService = (accountHash, network) => `valu.api.v2.${accountHash}.${network}`;

// Refresh the attestation challenge this long before the server expires it
const ATTESTATION_CHALLENGE_MARGIN_MS = 60 * 1000;

const nowSeconds = () => Math.floor(Date.now() / 1000);

export class ValuApi extends AccountBasedFintechApiTemplate {
  constructor() {
    super(VALU_SERVICE_ID, {
        authenticate: (seed) => this.authenticate(seed),
        reset: () => this.reset(),
        getAccount: (payload) => this.getAccount(payload),
        updateAccount: (payload) => this.updateAccount(payload),
        listPaymentMethods: (payload) => this.listPaymentMethods(payload),
        createPaymentMethod: (payload) => this.createPaymentMethod(payload),
        deletePaymentMethod: (payload) => this.deletePaymentMethod(payload),
        getTransferHistory: (payload) => this.getTransferHistory(payload),
        getRates: async (payload) => this.getRates(payload),
        sendTransaction: async (payload) => this.sendTransaction(payload),
        preflightTransaction: async (payload) => this.preflightTransaction(payload),
        getTransferInstructions: async (payload) => this.getTransferInstructions(payload),
        getAttestationPaymentStatus: async (payload) => this.getAttestationPaymentStatus(payload),
        getAttestationPaymentURL: async (payload) => this.getAttestationPaymentURL(payload), 
        getValuIdDeepLink: async (payload) => this.getValuIdDeepLink(payload),   
        getValuAttestationStatus: async (payload) => this.getValuAttestationStatus(payload),
        getOnRampOptions: async (payload) => this.getOnRampOptions(payload),
        getOnRampURL: async (payload) => this.getOnRampURL(payload),
        checkIdentityAvailable: async (payload) => this.checkIdentityAvailable(payload),
        startSumsubSession: async (payload) => this.startSumsubSession(payload),
        checkPopEligibility: async (payload) => this.checkPopEligibility(payload),
        claimSponsoredAttestation: async (payload) => this.claimSponsoredAttestation(payload),
    });

    // In-memory credentials and logins, keyed by `${accountHash}:${network}`
    this.credentials = {};
    this.loginsInFlight = {};
    this.attestationChallenges = {};

    this.service = this.buildService();
  }

  buildService() {
    return ValuService.build(() => this.networkContext, {
      getCredentials: (network) => this.getCredentials(network),
      onCredentialsRejected: (network) => this.walletLogin(network, { replaceStored: true }),
    });
  }

  get network() {
    return this.networkContext.network;
  }

  get accountId() {
    return this.credentials[this.credentialKey(this.network)]?.accountId ?? null;
  }

  get apiKey() {
    return this.credentials[this.credentialKey(this.network)]?.apiKey ?? null;
  }

  get activeAccount() {
    const activeAccount = Store.getState().authentication.activeAccount;
    if (activeAccount == null || activeAccount.accountHash == null) {
      throw new Error("You must be signed in to use the Valu service");
    }
    return activeAccount;
  }

  // Verus + EVM network the active profile is on, sent to the Valu API with every request
  get networkContext() {
    const testnetOverrides = Store.getState().authentication.activeAccount?.testnetOverrides || {};
    const isTestnet = Object.keys(testnetOverrides).length > 0;
    const ethCoinId = isTestnet && testnetOverrides.ETH ? testnetOverrides.ETH : 'ETH';

    return {
      network: isTestnet ? "VRSCTEST" : "VRSC",
      evmNetwork: coinsList[ethCoinId]?.network || (isTestnet ? "sepolia" : "homestead"),
    };
  }

  credentialKey(network) {
    return `${this.activeAccount.accountHash}:${network}`;
  }

  // The wallet's primary R-address on `network`: the address the Valu account is bound to
  getWalletRAddress(network = this.network) {
    const address = this.activeAccount.keys?.[network]?.[VRPC]?.addresses?.[0];
    if (!address) throw new Error(`No ${network} wallet address is available to sign in to Valu`);
    return address;
  }

  // Signs a LoginConsentProvisioningRequest with the wallet's R-address key.
  // Returns the request as base64, the format the Valu API expects.
  async signWalletChallenge(network, challengeId, name = '') {
    const provisionRequest = new primitives.LoginConsentProvisioningRequest({
      signing_address: this.getWalletRAddress(network),
      challenge: new primitives.LoginConsentProvisioningChallenge({
        challenge_id: challengeId,
        created_at: nowSeconds(),
        name,
      }),
    });

    const signed = await signIdProvisioningRequest({ id: network }, provisionRequest);
    return signed.toBuffer().toString('base64');
  }

  // ── Credential store (Keychain / Android Keystore) ───────────────────────────

  async readStoredCredentials(network) {
    try {
      const stored = await Keychain.getGenericPassword({
        service: credentialService(this.activeAccount.accountHash, network),
      });
      if (!stored || !stored.username || !stored.password) return null;

      const { apiSecret, accountId } = JSON.parse(stored.password);
      if (typeof apiSecret !== 'string' || apiSecret.length === 0) return null;

      return { apiKey: stored.username, apiSecret, accountId: accountId ?? null };
    } catch (e) {
      console.warn("Could not read stored Valu credentials:", e?.message);
      return null;
    }
  }

  async writeStoredCredentials(network, { apiKey, apiSecret, accountId }) {
    await Keychain.setGenericPassword(apiKey, JSON.stringify({ apiSecret, accountId }), {
      service: credentialService(this.activeAccount.accountHash, network),
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  clearCredentials = async (network = this.network) => {
    const key = this.credentialKey(network);
    delete this.credentials[key];
    delete this.attestationChallenges[key];
    try {
      await Keychain.resetGenericPassword({
        service: credentialService(this.activeAccount.accountHash, network),
      });
    } catch (e) {
      console.warn("Could not clear stored Valu credentials:", e?.message);
    }
  };

  // Old app versions kept the seed-derived login's apiKey in the service's stored data.
  // It is useless now (and its secret leaked), so drop it once the wallet login works.
  async removeLegacyLoginDetails() {
    try {
      const serviceData = await requestServiceStoredData(VALU_SERVICE_ID);
      if (serviceData?.loginDetails == null) return;

      // Required lazily: the services dispatcher imports ValuProvider (circular import)
      const { modifyServiceStoredDataForUser } = require('../../actions/actions/services/dispatchers/services');
      const { loginDetails, ...rest } = serviceData;
      await modifyServiceStoredDataForUser(rest, VALU_SERVICE_ID, this.activeAccount.accountHash);
    } catch (e) {
      console.warn("Could not remove legacy Valu login details:", e?.message);
    }
  }

  // ── Auth service ─────────────────────────────────────────────────────────────

  // Credentials for `network`: memory, then secure storage, then a wallet login.
  getCredentials = async (network = this.network) => {
    const key = this.credentialKey(network);
    if (this.credentials[key]) return this.credentials[key];

    const stored = await this.readStoredCredentials(network);
    if (stored) {
      this.credentials[key] = stored;
      this.markAuthenticated(network);
      return stored;
    }

    return await this.walletLogin(network);
  };

  // Proves wallet ownership to the server and gets apiKey + apiSecret.
  // Only one login runs per profile and network; parallel callers share it.
  walletLogin = async (network = this.network, { replaceStored = false } = {}) => {
    const key = this.credentialKey(network);

    if (this.loginsInFlight[key] == null) {
      this.loginsInFlight[key] = (async () => {
        if (replaceStored) {
          delete this.credentials[key];
          delete this.attestationChallenges[key];
        }

        const credentials = await this.runWalletLogin(network);

        this.credentials[key] = credentials;
        await this.writeStoredCredentials(network, credentials);
        this.markAuthenticated(network);
        await this.removeLegacyLoginDetails();

        return credentials;
      })().finally(() => {
        delete this.loginsInFlight[key];
      });
    }

    return await this.loginsInFlight[key];
  };

  async runWalletLogin(network, attempt = 0) {
    try {
      const challenge = await this.service.requestLoginChallenge(network);
      if (!challenge?.success || !challenge.challengeId) {
        throw new Error(challenge?.error || "Could not get a Valu login challenge");
      }

      const request = await this.signWalletChallenge(network, challenge.challengeId);
      const res = await this.service.submitWalletLogin(network, request);

      if (!res?.success || !res.apiKey || !res.apiSecret) {
        throw new Error(res?.error || "Valu login failed");
      }

      return { apiKey: res.apiKey, apiSecret: res.apiSecret, accountId: res.authenticatedAs ?? null };
    } catch (e) {
      // A used/expired challenge just needs a fresh one
      if (e?.code === VALU_AUTH_CODES.CHALLENGE_INVALID && attempt === 0) {
        return await this.runWalletLogin(network, attempt + 1);
      }
      if (e?.code === VALU_AUTH_CODES.INVALID) {
        throw new Error("Valu could not verify your wallet signature. Check that your device clock is correct and try again.");
      }
      throw e;
    }
  }

  markAuthenticated(network) {
    if (network !== this.network) return;

    Store.dispatch({
      type: AUTHENTICATE_VALU_SERVICE,
      payload: {
        accountId: this.accountId,
      },
    });
  }

  // Kept for existing callers. The seed is no longer used: the login is proved with the
  // wallet's R-address key, and the server issues the signing secret.
  authenticate = async (_seed = null, reauthenticate = false) => {
    const network = this.network;
    const credentials = reauthenticate
      ? await this.walletLogin(network, { replaceStored: true })
      : await this.getCredentials(network);

    return { apiKey: credentials.apiKey, authenticatedAs: credentials.accountId };
  };

  // Clears in-memory state on sign out. Stored credentials stay so the next sign in
  // doesn't need a new wallet login.
  reset = () => {
    this.credentials = {};
    this.loginsInFlight = {};
    this.attestationChallenges = {};
    this.service = this.buildService();
    Store.dispatch({
      type: DEAUTHENTICATE_VALU_SERVICE,
    });
  };

  // ── /attestation-status ─────────────────────────────────────────────────────

  // A server challenge for /attestation-status, reused until shortly before it expires
  getAttestationChallengeId = async ({ refresh = false } = {}) => {
    const key = this.credentialKey(this.network);
    const cached = this.attestationChallenges[key];

    if (!refresh && cached && cached.expiresAt - ATTESTATION_CHALLENGE_MARGIN_MS > Date.now()) {
      return cached.challengeId;
    }

    const res = await this.service.getAuthChallenge('attestation-status');
    if (!res?.success || !res.challengeId) {
      throw new Error(res?.error || "Could not get a Valu attestation challenge");
    }

    this.attestationChallenges[key] = {
      challengeId: res.challengeId,
      expiresAt: Date.parse(res.expiresAt) || Date.now() + 5 * 60 * 1000,
    };
    return res.challengeId;
  };

  // Signs a fresh attestation-status proof and fetches the status. Returns the reply and
  // the signed request (also accepted by /attestation-retry-new-payment).
  checkAttestationStatus = async () => {
    const send = async (refresh) => {
      const challengeId = await this.getAttestationChallengeId({ refresh });
      const request = await this.signWalletChallenge(this.network, challengeId, "Valu attestation session");
      const reply = await this.service.getAttestationPaymentStatus({ request });
      return { reply, request };
    };

    let result = await send(false);
    if (result.reply?.success === false && result.reply.error === "Invalid or expired provisioning request.") {
      result = await send(true);
    }
    return result;
  };

  getAccount = async (accountId) => {

    let account = await this.service.getaccount(accountId || this.accountId);
    return account;
  };

  updateAccount = async ({ accountId, updateObj }) => {
    return await this.service.updateAccount(
      accountId == null ? this.accountId : accountId,
      updateObj
    );
  };

  getAccount = async (payload = {}) => {
    const { accountId } = payload;
    return await this.service.getAccount(accountId == null ? this.accountId : accountId);
  };

  loadValuCoinAddresses = async () => {};

  getAttestationPaymentStatus = async (payload) => {
    return await this.service.getAttestationPaymentStatus(payload);
  }

  getAttestationPaymentURL = async () => {  
    return await this.service.getAttestationPaymentURL();
  }

  getValuIdDeepLink = async (payload = {}) => { 
    return await this.service.getValuIdDeepLink(payload);
  }

  getValuAttestationStatus = async () => {
    return await this.service.getValuAttestationStatus();
  }

  getOnRampOptions = async (payload) => {
    return await this.service.getOnRampOptions(payload);
  }

  getOnRampURL = async (payload) => {
    return await this.service.getOnRampURL(payload);
  } 

  getOnRampStatus = async (requestId) => {
    return await this.service.getOnRampStatus(requestId);
  }

  getOffRampOptions = async (payload) => {
    return await this.service.getOffRampOptions(payload);
  }

  getOffRampURL = async (payload) => {
    return await this.service.getOffRampURL(payload);
  } 

  authenticateRegisteredUser = async () => {
    return await this.service.authenticateRegisteredUser();
  }

  checkIdentityAvailable = async (identityName) => {
    return await this.service.checkIdentityAvailable(identityName);
  }

  provisionIdentityRequest = async (payload) => {
    return await this.service.provisionIdentityRequest(payload);
  }

  startSumsubSession = async (payload) => {
    return await this.service.startSumsubSession(payload);
  }

  checkPopEligibility = async (payload) => {
    return await this.service.checkPopEligibility(payload);
  }

  claimSponsoredAttestation = async (payload) => {
    return await this.service.claimSponsoredAttestation(payload);
  }

  initiateIAPSession = async () => {
    return await this.service.initiateIAPSession();
  }

  confirmIAPPayment = async (payload) => {
    return await this.service.confirmIAPPayment(payload);
  }

  retryAttestationPayment = async (payload) => {
    return await this.service.retryAttestationPayment(payload);
  }

  // ── USDC → vUSDC onramp ──────────────────────────────────────────────────────

  getUsdcDepositInfo = async () => {
    return await this.service.getUsdcDepositInfo();
  };

  initiateUsdcToVerus = async (payload) => {
    return await this.service.initiateUsdcToVerus(payload);
  };

  getUsdcConversionStatus = async (conversionId) => {
    return await this.service.getUsdcConversionStatus(conversionId);
  };

  getActiveUsdcConversions = async () => {
    return await this.service.getActiveUsdcConversions();
  };

  getUsdcConversionHistory = async () => {
    return await this.service.getUsdcConversionHistory();
  };

  // ── Part A: vUSDC → EVM USDC (offramp from Verus) ────────────────────────────

  getVerusToEvmDepositInfo = async () => {
    return await this.service.getVerusToEvmDepositInfo();
  };

  initiateVerusToEvmOfframp = async (payload) => {
    return await this.service.initiateVerusToEvmOfframp(payload);
  };

  getVerusToEvmStatus = async (conversionId) => {
    return await this.service.getVerusToEvmStatus(conversionId);
  };

  getActiveVerusToEvmConversions = async () => {
    return await this.service.getActiveVerusToEvmConversions();
  };

  getVerusToEvmHistory = async () => {
    return await this.service.getVerusToEvmHistory();
  };

  // ── Part B: EVM USDC → Fiat (Paybis cashout) ─────────────────────────────────

  getEvmToFiatOptions = async (payload) => {
    return await this.service.getEvmToFiatOptions(payload);
  };

  initiateEvmToFiat = async (payload) => {
    return await this.service.initiateEvmToFiat(payload);
  };

  getEvmToFiatPaymentDetails = async (requestId) => {
    return await this.service.getEvmToFiatPaymentDetails(requestId);
  };

  getEvmToFiatStatus = async (requestId) => {
    return await this.service.getEvmToFiatStatus(requestId);
  };

}