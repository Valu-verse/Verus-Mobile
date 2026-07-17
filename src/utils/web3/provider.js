import Web3Interface from './web3Interface'
import {
  ETH_HOMESTEAD,
  ETH_SEPOLIA,
  ETH_POLYGON,
  ETH_POLYGON_AMOY,
  ETHERSCAN_API_KEY,
  INFURA_PROJECT_ID,
} from "../../../env/index";

const POLYGON_AMOY_RPC_URL = 'https://rpc-amoy.polygon.technology/';

const Web3Providers = {
  [ETH_HOMESTEAD]: new Web3Interface(ETH_HOMESTEAD, {
    etherscan: ETHERSCAN_API_KEY,
    infura: INFURA_PROJECT_ID
  }),
  [ETH_SEPOLIA]: new Web3Interface(ETH_SEPOLIA, {
    etherscan: ETHERSCAN_API_KEY,
    infura: INFURA_PROJECT_ID
  }),
  [ETH_POLYGON]: new Web3Interface(ETH_POLYGON, {
    etherscan: ETHERSCAN_API_KEY,
    infura: INFURA_PROJECT_ID
  }),
  [ETH_POLYGON_AMOY]: new Web3Interface(ETH_POLYGON_AMOY, {
    etherscan: ETHERSCAN_API_KEY,
    infura: INFURA_PROJECT_ID
  }, POLYGON_AMOY_RPC_URL),
}

Object.freeze(Web3Providers);

export const getWeb3ProviderForNetwork = (network = ETH_HOMESTEAD) => {
  if (Web3Providers.hasOwnProperty(network)) {
    return Web3Providers[network];
  } else {
    throw new Error(`No web3 provider for network ${network}`);
  }
};

export const deleteAllWeb3Contracts = () => {
  for (const network in Web3Providers) {
    Web3Providers[network].deleteAllContracts()
  }
}