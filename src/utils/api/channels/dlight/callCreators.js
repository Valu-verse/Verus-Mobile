// Replaced react-native-verus-light-client with null functions
const VerusLightClient = {
  request: () => Promise.resolve({ error: { message: "DLight disabled", code: -1 } })
}
import ApiException from '../../errors/apiError'
import { DLIGHT_PRIVATE } from '../../../constants/intervalConstants'

// State requests
export * from './state/synchronizer'
export * from './state/walletFolder'

// JSON-RPC requests
export * from './requests/getAddresses'
export * from './requests/getPrivateBalance'
export * from './requests/getBlockCount'
export * from './requests/getInfo'
export * from './requests/getTransactions'
export * from './requests/preflightPrivateTransaction'
export * from './requests/sendPrivateTransaction'

/**
 * Makes a request to the light daemon client
 * @param {String} coinId The chain ticker for the coin to make the request for
 * @param {String} accountHash The account hash of the user to make the request for
 * @param {String} coinProto The coin protocol of the coin to make the request for
 * @param {String} reqId The ID of the request, that will be returned in the promise resolution/rejection that the request returns
 * @param {String} method The request type
 * @param {String[]} params Paramters to pass in with the request
 */
export const makeDlightRequest = (coinId, accountHash, coinProto, reqId, method, params) => {
  return new Promise((resolve, reject) => {
    reject(
      new ApiException(
        "DLight functionality has been disabled",
        null,
        coinId,
        DLIGHT_PRIVATE,
        -1
      )
    );
  })
}