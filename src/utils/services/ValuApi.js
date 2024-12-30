import Store from "../../store";
import { requestSeeds } from "../auth/authBox";
import { VALU_SERVICE_ID, CONNECTED_SERVICE_DISPLAY_INFO} from "../constants/services";
import { VALU_SERVICE } from "../constants/intervalConstants"
import { AUTHENTICATE_VALU_SERVICE, DEAUTHENTICATE_VALU_SERVICE } from "../constants/storeType";
import { AccountBasedFintechApiTemplate } from "./ServiceTemplates";
import ValuService from './ValuService'
import { storeLoginDetails } from '../../actions/actions/services/dispatchers/valu/updates';
import crypto from 'crypto'
import { mnemonicToSeed } from 'bip39'

export class ValuApi extends AccountBasedFintechApiTemplate {
  constructor() {
    super(VALU_SERVICE_ID, {
        authenticate: (seed) => this.authenticate(seed),
        reset: () => this.reset(),
        createAccount: (payload) => this.createAccount(payload),
        getAccount: (payload) => this.getAccount(payload),
        updateAccount: (payload) => this.updateAccount(payload),
        uploadDocument: (payload) => this.uploadDocument(payload),
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
    });

    this.service = ValuService.build();
    this.bearerToken = null;
    this.apiKey = null;
    this.accountId = null;
  }

  async bearerFromSeed(seed) {
    var ripemd160 = crypto.createHash("ripemd160");
    var sha256 = crypto.createHash("sha256");

    const VALU_SERVICE_CANONICAL = Buffer.from(VALU_SERVICE_ID, "utf8");

    const sha256Hash = sha256
      .update(await mnemonicToSeed(seed))
      .update(VALU_SERVICE_CANONICAL)
      .digest();

    return ripemd160.update(sha256Hash).digest().toString("hex");
  };

  authenticate = async (seed, reauthenticate = false) => {

    if (reauthenticate) {
      this.service.deauthenticate()
    }

    const key = await this.bearerFromSeed(seed);
    const authenticated = Store.getState().channelStore_valu_service.authenticated;
    if (authenticated && !reauthenticate)
      return { apiKey: this.apiKey, authenticatedAs: this.accountId };
    
    const res = await this.service.submitAuthToken(key);

    this.bearerToken = key;
    this.apiKey = res.apiKey;
    this.accountId = res.authenticatedAs;

    this.service.authenticate(this.bearerToken, this.apiKey);

    await this.initAccountData()
    console.log("data initiated", this.accountId, this.apiKey, this.bearerToken);
    return res;
  };

  initAccountData = async () => {
    
    Store.dispatch({
      type: AUTHENTICATE_VALU_SERVICE,
      payload: {
        accountId: this.accountId,
      },
    });
  };

  reset = () => {
    this.bearerToken = null;
    this.apiKey = null;
    this.accountId = null;
    this.service.deauthenticate();
    this.service = ValuService.build();
    Store.dispatch({
      type: DEAUTHENTICATE_VALU_SERVICE,
    });
  };

  createAccount = async ( raddress, email, data) => {

    if(!(data.key && data.apiKey && data.raddress))
    {
      throw new Error("Server did not authenticate" + data )
    }
    console.log("data", data);

    // log the Valu servers JWT token 
    this.bearerToken = data.key;
    this.apiKey = data.apiKey;

    if (data.accountId)
      this.accountId = data.accountId;

    const serverAuthenticated = await this.service.authenticate(data.key, data.apiKey);
    console.log("serverAuthenticated", serverAuthenticated)
    
    if(!serverAuthenticated.success)
    {
      throw new Error("Server did not authenticate")
    }
        
    const newAccount = await this.service.createAccount(username, email, data.apiKey, data.iAddress);
   // console.log("newAccount", JSON.stringify(newAccount, null, 2))

    if(newAccount.error == "Acount already registered.")
    {
      this.accountId = newAccount.data.accountId;
    }
    else if(!newAccount.success) {
      throw new Error(newAccount.error)
    } else {
      this.accountId = newAccount.data.data.id;
    }

    await storeLoginDetails({email, apiKey: data.apiKey, accountId: this.accountId, iAddress: data.iAddress });

    console.log("loginstored", {email, apiKey: data.apiKey, accountId: this.accountId })

    return this.accountId
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

  getValuIdDeepLink = async () => { 
    return await this.service.getValuIdDeepLink();
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

}