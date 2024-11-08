import axios from 'axios';
import crypto from 'crypto'
import { mnemonicToSeed } from 'bip39'
import { Platform } from 'react-native'
import RNFS from "react-native-fs"

import { VALU_URL } from '../constants/constants';
import { VALU_SERVICE_ID } from '../constants/services';
import { Buffer } from 'buffer'

const parseError = (error) => (
  error.response ? error.response.data.message : error.toString()
)

class ValuService {
  constructor(url, service) {
    this.url = url;
    this.service = service;
    this.authInterceptor = null;
    this.valuToken = null;
    this.apiKey = null;

    this.cache = {
      accounts: {}
    }
  }

  static build() {
    const service = axios.create({
      baseURL: VALU_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return new ValuService(VALU_URL, service);
  }

  static signUrlString(url_body, bearer) {
    return crypto.createHmac("sha256", bearer).update(url_body).digest().toString("hex");
  }

  static signUrlBuffer = (url, data, bearer) => {
    const urlBuffer = Buffer.from(url);
    const dataToBeSigned = Buffer.concat([urlBuffer, data]);

    return crypto.createHmac("sha256", bearer).update(dataToBeSigned).digest().toString("hex");
  };

  static formatCryptoSrn = (coinObj, address) => {
    if (coinObj.id === "BTC") {
      return this.formatSrn(address, "bitcoin");
    } else if (coinObj.proto === "erc20" || coinObj.proto === "eth") {
      return this.formatSrn(address, "ethereum");
    } else {
      throw new Error(`${coinObj.id} SRNs are not supported.`);
    }
  };

  static decodeSrn = (srn) => {
    const srnArr = srn.split(":");

    return {
      id: srnArr[1],
      type: srnArr[0],
    };
  };

  static formatSrn = (id, srnType) => {
    return `${srnType}:${id}`;
  };

  static formatCall = async (call) => {
    try {
      const { data } = await call();
      return data;
    } catch (error) {
      throw new Error(parseError(error));
    }
  };

  static bearerFromSeed = async (seed) => {
    var ripemd160 = crypto.createHash("ripemd160");
    var sha256 = crypto.createHash("sha256");

    const VALU_SERVICE_CANONICAL = Buffer.from(VALU_SERVICE_ID, "utf8");

    const sha256Hash = sha256
      .update(await mnemonicToSeed(seed))
      .update(VALU_SERVICE_CANONICAL)
      .digest();

    return ripemd160.update(sha256Hash).digest().toString("hex");
  };

  static formatUploadUri = (uri) => {
    return Platform.OS === "android" ? uri : uri.replace("file://", "");
  };

  authenticate(valuToken, apiKey) {
    if (this.valuToken == null) {
      this.apiKey = apiKey;
      this.valuToken = valuToken;

      this.authInterceptor = this.service.interceptors.request.use(
        (config) => {
          config.url = config.url.includes("timestamp")
            ? config.url
            : config.url + `?timestamp=${Date.now()}`;

          if (config.method === "get") {
            config.headers["x-api-signature"] = ValuService.signUrlString(
              axios.getUri(config),
              valuToken
            );
          } else {
            let uri = axios.getUri(config);

            if (uri.substr(0, 4) !== "http") {
              uri = config.baseURL.replace(/\/+$/, "") + uri;
            }
            console.log("uri", config.data == null ? uri : uri + JSON.stringify(config.data) );
            config.headers["x-api-signature"] = ValuService.signUrlString(
              config.data == null ? uri : uri + JSON.stringify(config.data),
              valuToken
            );
          }
          config.headers["x-payload-digest-alg"] = "sha256";
          config.headers["x-api-key"] = apiKey;

          return config;
        },
        (error) => {
          return Promise.reject(error);
        }
      );
    }
  }

  deauthenticate() {
    this.valuToken = null;
    this.apiKey = null;
    this.service.interceptors.request.eject(this.authInterceptor);
    this.authInterceptor = null;

    this.cache = {
      accounts: {}
    }
  }

  submitAuthToken = async (secretKey) => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/sessions/auth/key`, {
        secretKey,
      });
    });
  };

  getOnRampURL = async () => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/create-paybis-onramp-session`);
    });
  };

  getAttestationPaymentStatus = async (signedRequest) => {
    
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/attestation-status`,signedRequest);
    });
  };

  getAttestationPaymentSessionId = async (address) => {

    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/attestation-session:${address}`);
    });
  };

  getAttestationPaymentURL = async () => {

    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/attestation-payment`);
    });
  };

  retryAttestationPayment = async (signedRequest) => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/attestation-retry-new-payment`,signedRequest);
    });
  };

  getValuIdDeepLink = async (valuId) => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/valu-id-deeplink`,valuId);
    });
  };


  createAccount = async (valuAccount) => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/accounts`, valuAccount);
    }, true);
  };

  getAccount = async (id) => {   
    const account = await ValuService.formatCall(() => {
      return this.service.get(`/accounts/${id}`);
    }, true);

    return account
  };

  getPaymentMethod = async (id) => {
    return await ValuService.formatCall(() => {
      return this.service.get(`/paymentMethod/${id}`);
    }, true);
  };

  updateAccount = async (id, updateObj) => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/accounts/${id}`, updateObj);
    }, true);
  };


  uploadFile = async (uri, url, format = "image/jpeg") => {
    return await ValuService.formatCall(async () => {
      const base64 = await RNFS.readFile(uri, "base64");
      const buffer = Buffer.from(base64, "base64");

      const res = await axios.post(url, buffer, {
        headers: {
          "Content-Type": `${format}; charset=utf-8`,
          "X-Api-Key": this.apiKey,
          "X-Api-Signature": ValuService.signUrlBuffer(url, buffer, this.valuToken),
        },
      });

      // const res = await fetch(url, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": `${format}; charset=utf-8`,
      //     "X-Api-Key": this.apiKey,
      //     "X-Api-Signature": ValuService.signUrlBuffer(
      //       url,
      //       buffer,
      //       this.valuToken
      //     ),
      //   },
      //   body: buffer,
      // });

      return { data: { buffer, res } };
    }, true);
  };

  createPaymentMethod = async (paymentMethod) => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/paymentMethods`, paymentMethod);
    }, true);
  };

  deletePaymentMethod = async (paymentMethod) => {
    return await ValuService.formatCall(() => {
      return this.service.delete(`${this.url}/paymentMethod/${paymentMethod.id}`);
    }, true);
  };

  listPaymentMethods = async () => {
    return await ValuService.formatCall(() => {
      return this.service.get("/paymentMethods");
    }, true);
  };

  createTransfer = async (
    source,
    sourceCurrency,
    sourceAmount,
    dest,
    destCurrency,
    message,
    autoConfirm,
    amountIncludesFees = false
  ) => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/transfers`, {
        source,
        sourceCurrency,
        sourceAmount,
        dest,
        destCurrency,
        message: message == null ? "" : message,
        autoConfirm,
        amountIncludesFees
      });
    }, true);
  };

  confirmTransfer = async (transferId) => {
    return await ValuService.formatCall(() => {
      return this.service.post(`${this.url}/transfers/${transferId}/confirm`);
    }, true);
  };

  getTransferInstructions = async (transferId) => {
    return await ValuService.formatCall(() => {
      return this.service.get(`/transfer/${transferId}`);
    }, true);
  }

  getTransferHistory = async () => {
    return await ValuService.formatCall(() => {
      return this.service.get("/transfers");
    }, true);
  };

  getTransfer = async (transferId) => {
    return await ValuService.formatCall(() => {
      return this.service.get(`/transfers/${transferId}`);
    }, true);
  };

  getRates = async (mode = "PRICED") => {
    const oneTimeService = axios.create({
      baseURL: this.url,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return await ValuService.formatCall(() => {
      return oneTimeService.get(`/rates?as=${mode}`);
    });
  };

  getSupportedCountries = async () => {
    const oneTimeService = axios.create({
      baseURL: this.url,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return await ValuService.formatCall(() => {
      return oneTimeService.get("/widget/supportedCountries");
    });
  };
}


export default ValuService;
