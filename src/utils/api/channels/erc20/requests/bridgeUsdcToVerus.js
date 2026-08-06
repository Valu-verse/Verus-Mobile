/**
 * bridgeUsdcToVerus.js
 * Transfers USDC from the user's EVM wallet to a Valu bridge deposit address.
 * Reuses the same transfer() mechanism as the regular ERC20 simple send.
 */
import { ethers } from 'ethers';
import { getWeb3ProviderForNetwork } from '../../../../web3/provider';
import { ERC20 } from '../../../../constants/intervalConstants';
import { scientificToDecimal } from '../../../../math';
import { requestPrivKey } from '../../../../auth/authBox';
import { cleanEthersErrorMessage } from '../../../../errors';
import { ETHERS } from '../../../../constants/web3Constants';

/**
 * @param {object} coinObj  - The USDC coin object (from CoinDirectory)
 * @param {string} toAddress - Bridge deposit address returned by Valu API
 * @param {number|string} amount - Amount of USDC to send (human-readable, e.g. "50.00")
 * @returns {{ err: boolean, result: object }}
 */
export const bridgeUsdcToVerus = async (coinObj, toAddress, amount) => {
  try {
    const Web3Provider = getWeb3ProviderForNetwork(coinObj.network);
    const privKey = await requestPrivKey(coinObj.id, ERC20);
    const contract = Web3Provider.getContract(coinObj.currency_id);

    const amountBn = ethers.parseUnits(
      scientificToDecimal(amount.toString()),
      coinObj.decimals,
    );

    const feeData = await Web3Provider.InfuraProvider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas;
    if (maxFeePerGas == null) throw new Error("Couldn't get current gas price");

    const signableContract = contract.connect(
      new ethers.Wallet(ethers.hexlify(privKey), Web3Provider.InfuraProvider),
    );

    const gasEst = BigInt(
      await signableContract.transfer.estimateGas(toAddress, amountBn),
    );
    // 20% buffer on gas
    const gasLimit = gasEst + gasEst / 5n;

    const response = await signableContract.transfer(toAddress, amountBn, {
      gasLimit,
      maxFeePerGas,
    });

    return {
      err: false,
      result: {
        txid: response.hash,
        fromAddress: response.from,
        toAddress,
        value: Number(ethers.formatUnits(amountBn, coinObj.decimals)),
        fee: Number(ethers.formatUnits(maxFeePerGas * gasLimit, ETHERS)),
        feeCurr: 'ETH',
      },
    };
  } catch (e) {
    return {
      err: true,
      result: cleanEthersErrorMessage(e.message, e.body),
    };
  }
};
