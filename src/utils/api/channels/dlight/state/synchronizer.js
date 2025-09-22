// Replaced react-native-verus-light-client with null functions
const VerusLightClient = {
  startSync: () => Promise.reject(new Error("DLight functionality has been disabled")),
  stopSync: () => Promise.reject(new Error("DLight functionality has been disabled"))
}

// Uses a coin's ticker symbol (id), protocol (btc || vrsc)
// and user's account hash to identify a light client wallet
// and start syncing it to the blockchain
export const startSync = (coinId, coinProto, accountHash) => {
  throw new Error("DLight functionality has been disabled")
}

// Uses a coin's ticker symbol (id), protocol (btc || vrsc)
// and user's account hash to identify a light client wallet
// and stop it syncing to the blockchain
export const stopSync = (coinId, coinProto, accountHash) => {
  throw new Error("DLight functionality has been disabled")
}