/*
  dlight-servers
  2026-02-07: Added Verus testnet DLight endpoint (api.verustest.net:8120).
*/
let dlightServers = {
  vrsc: ['lightwallet.verus.services:8120'],
  vrsctest: ['lightwalletd.verustest.net:8125'],
  zec: ['lightwalletd.z.cash:9067'],
  zectest: ['lightwalletd.testnet.z.cash:9067']
};

module.exports = {
  dlightServers
};
