import { coinsList } from "./CoinsList";

export const getSupportedNetworks = (coinObj) => {
  if (!coinObj || (coinObj.proto !== 'vrsc' && !coinObj.is_pbaas)) {
    return [];
  }

  // Main Verus networks are always supported for Verus compatible coins
  const networks = [];
  
  // Add VRSC (Mainnet) or VRSCTEST (Testnet) based on the coin's testnet status
  if (coinObj.testnet) {
    if (coinsList.VRSCTEST) networks.push(coinsList.VRSCTEST);
  } else {
    if (coinsList.VRSC) networks.push(coinsList.VRSC);
  }

  // Find other PBaaS systems/networks
  Object.values(coinsList).forEach((coin) => {
    // Check if it's a PBaaS system definition
    // Criteria:
    // 1. It is a VRSC protocol coin
    // 2. It is not the main VRSC/VRSCTEST (already added)
    // 3. Its currency_id equals its system_id (implies it is a chain/system definition)
    // 4. It matches the testnet status of the current coin
    if (
      coin.proto === 'vrsc' &&
      coin.id !== 'VRSC' && 
      coin.id !== 'VRSCTEST' &&
      coin.currency_id === coin.system_id &&
      !!coin.testnet === !!coinObj.testnet
    ) {
      networks.push(coin);
    }
  });

  return networks;
};

