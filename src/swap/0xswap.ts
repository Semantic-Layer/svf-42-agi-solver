import { config as dotenv } from 'dotenv';
import { getContract, erc20Abi, maxUint256, concat, numberToHex, size } from 'viem';
import type { Account, Hex } from 'viem';
import { base } from 'viem/chains';
import { chainId, publicClientHTTP, walletClient } from '../clients.ts';
import logger from '../logger.ts';

// load env vars
dotenv();
const { ZERO_EX_API_KEY } = process.env;
if (!ZERO_EX_API_KEY) throw new Error('missing ZERO_EX_API_KEY.');

// fetch headers
const headers = new Headers({
	'Content-Type': 'application/json',
	'0x-api-key': ZERO_EX_API_KEY,
	'0x-version': 'v2',
});

/**
 * Helper function to get the token contract
 * @param address - The address of the token contract
 * @returns The token contract
 */
const getTokenContract = (address: string) => {
	return getContract({
		address: address as `0x${string}`,
		abi: erc20Abi,
		client: publicClientHTTP,
	});
};

/**
 * Fetch price for token swap
 * @param sellToken - The address of the token to sell
 * @param buyToken - The address of the token to buy
 * @param sellAmount - The amount of the token to sell
 * @param slippageBps - The slippage basis points (e.g., 100 for 1%)
 * @returns The price of the token swap
 */
const fetchPrice = async (
	sellToken: string,
	buyToken: string,
	sellAmount: string,
	slippageBps: number = 100
) => {
	const priceParams = new URLSearchParams({
		chainId: chainId.toString(),
		sellToken,
		buyToken,
		sellAmount,
		slippageBps: slippageBps.toString(),
		taker: walletClient.account?.address as Hex,
	});
	logger.table('Route Params', {
		chainId: chainId,
		sellToken: sellToken,
		buyToken: buyToken,
		sellAmount: sellAmount,
		slippageBps: slippageBps.toString(),
		taker: walletClient.account?.address,
	});

	const priceResponse = await fetch(
		'https://api.0x.org/swap/permit2/price?' + priceParams.toString(),
		{ headers }
	);

	const price = await priceResponse.json();
	logger.event(`🔍 API Request: https://api.0x.org/swap/permit2/price?${priceParams.toString()}`);
	if (price.liquidityAvailable) {
		logger.success('[Check Price] Liquidity is available for the swap');
	} else {
		logger.error('[Check Price] Liquidity is not available for the swap, please try again later');
		throw new Error('Liquidity not available');
	}
	return price;
};

/**
 * Set the allowance
 * @param token - The token contract
 * @param price - The price of the token swap
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const checkAndSetAllowance = async (token: any, price: any) => {
	logger.info('🔑 ERC-20 token detected, checking allowance...');
	if (price.issues.allowance !== null) {
		try {
			const { request } = await token.simulate.approve([
				price.issues.allowance.spender,
				maxUint256,
			]);
			const hash = await token.write.approve(request.args);
			logger.event(`Approved Permit2 to spend sellToken. ${hash}`);
			await publicClientHTTP.waitForTransactionReceipt({ hash });
		} catch (error) {
			logger.error(`Error approving Permit2: ${error}`);
		}
	} else {
		logger.info('sellToken already approved for Permit2');
	}
};

/**
 * Fetch quote for token swap
 * @param sellToken - The address of the token to sell
 * @param buyToken - The address of the token to buy
 * @param sellAmount - The amount of the token to sell
 * @param slippageBps - The slippage basis points (e.g., 100 for 1%)
 * @returns The quote of the token swap
 */
const fetchQuote = async (
	sellToken: string,
	buyToken: string,
	sellAmount: string,
	slippageBps: number = 100
) => {
	logger.info(`Fetching quote to swap ${sellAmount} (wei) of ${sellToken} for ${buyToken}`);
	const quoteParams = new URLSearchParams({
		chainId: chainId.toString(),
		sellToken,
		buyToken,
		sellAmount,
		slippageBps: slippageBps.toString(),
		taker: walletClient.account?.address as Hex,
	});

	const quoteResponse = await fetch(
		'https://api.0x.org/swap/permit2/quote?' + quoteParams.toString(),
		{ headers }
	);

	const quote = await quoteResponse.json();
	if (quote.liquidityAvailable) {
		logger.success('[Fetch Quote] Liquidity is available for the swap');
	} else {
		logger.error('[Fetch Quote] Liquidity is not available for the swap');
		throw new Error('Liquidity not available');
	}
	return quote;
};

/**
 * Sign Permit2 EIP712 message
 * @param quote - The quote of the token swap
 * @returns The signature of the token swap
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signPermit2 = async (quote: any) => {
	let signature: Hex | undefined;
	if (quote.permit2?.eip712) {
		try {
			signature = await walletClient.signTypedData(quote.permit2.eip712);
			logger.info('Signed permit2 message from quote response');
		} catch (error) {
			logger.error(`Error signing permit2 coupon: ${error}`);
		}

		if (signature && quote?.transaction?.data) {
			const signatureLengthInHex = numberToHex(size(signature), {
				signed: false,
				size: 32,
			});

			const transactionData = quote.transaction.data as Hex;
			const sigLengthHex = signatureLengthInHex as Hex;
			const sig = signature as Hex;

			quote.transaction.data = concat([transactionData, sigLengthHex, sig]);
		} else {
			throw new Error('Failed to obtain signature or transaction data');
		}
	}
	return signature;
};

/**
 * Submit transaction with Permit2 signature
 * @param quote - The quote of the token swap
 * @param signature - The signature of the token swap
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const submitTransaction = async (quote: any, signature: Hex | undefined): Promise<string> => {
	const nonce = await publicClientHTTP.getTransactionCount({
		address: walletClient.account?.address as Hex,
	});

	if (signature && quote.transaction.data) {
		const signedTransaction = await walletClient.signTransaction({
			account: walletClient.account as Account,
			chain: base,
			gas: !!quote?.transaction.gas ? BigInt(quote?.transaction.gas) : undefined,
			to: quote?.transaction.to,
			data: quote.transaction.data,
			gasPrice: !!quote?.transaction.gasPrice ? BigInt(quote?.transaction.gasPrice) : undefined,
			nonce: nonce,
		});

		const hash = await walletClient.sendRawTransaction({
			serializedTransaction: signedTransaction,
		});

		logger.success(`Transaction hash: ${hash}`);
		logger.item(`📒 See tx details at https://basescan.org/tx/${hash}. Checking the status...`);
		return hash;
	} else {
		logger.error('Failed to obtain a signature, transaction not sent.');
		throw new Error('Failed to obtain a signature, transaction not sent.');
	}
};

/**
 * Execute token swap
 * @param tokenToSellAddress - The address of the token to sell
 * @param tokenToBuyAddress - The address of the token to buy
 * @param sellAmountInput - The amount of the token to sell
 * @param slippageBps - The slippage basis points (e.g., 100 for 1%)
 * @returns The minimum buy amount of the token swap
 */
const executeSwap = async (
	tokenToSellAddress: string,
	tokenToBuyAddress: string,
	sellAmountInput: string,
	slippageBps: number = 100
) => {
	const sellToken = getTokenContract(tokenToSellAddress);

	const price = await fetchPrice(
		tokenToSellAddress,
		tokenToBuyAddress,
		sellAmountInput,
		slippageBps
	);
	await checkAndSetAllowance(sellToken, price);
	const quote = await fetchQuote(
		tokenToSellAddress,
		tokenToBuyAddress,
		sellAmountInput,
		slippageBps
	);
	const signature = await signPermit2(quote);
	const hash = await submitTransaction(quote, signature);

	return {
		hash,
		minBuyAmount: quote.minBuyAmount,
	};
};

/**
 * Default swap function
 * @dev Example: defaultSwap('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', '0x4200000000000000000000000000000000000006', '1000', 0.01) USDC -> WETH
 * @param tokenToSellAddress - The address of the token to sell
 * @param tokenToBuyAddress - The address of the token to buy
 * @param sellAmount - The amount of the token to sell
 * @param slippageBps - The slippage basis points (e.g., 100 for 1%)
 * @returns The minimum buy amount of the token swap
 */
export const defaultSwap = async (
	tokenToSellAddress: string,
	tokenToBuyAddress: string,
	sellAmount: string,
	slippageBps: number = 100
) => {
	try {
		// Execute swap
		logger.info(
			`🧭 Executing swap from ${tokenToSellAddress} to ${tokenToBuyAddress} with ${sellAmount} (wei)`
		);
		let { hash, minBuyAmount } = await executeSwap(
			tokenToSellAddress,
			tokenToBuyAddress,
			sellAmount,
			slippageBps
		);

		// Wait for transaction to be mined
		const result = await publicClientHTTP.waitForTransactionReceipt({
			hash: hash as `0x${string}`,
		});
		let retries = 0;
		const maxRetries = 5;
		while (retries < maxRetries) {
			if (result.status === 'success') {
				logger.success(
					`🎉 [0xSwap] Transaction confirmed${retries > 0 ? ` on retry attempt ${retries}` : ''}, hash: ${hash}`
				);
				return minBuyAmount;
			}
			retries++;
			logger.error(`🚨 Transaction failed${retries > 1 ? ` on retry attempt ${retries - 1}` : ''}`);
			if (retries === maxRetries) {
				throw new Error('Transaction failed after maximum retries');
			}
			logger.info(`Retrying transaction (${retries}/${maxRetries}) after 1 second...`);
			await new Promise(resolve => setTimeout(resolve, 1000));
			try {
				const { hash: newHash, minBuyAmount: newMinBuyAmount } = await executeSwap(
					tokenToSellAddress,
					tokenToBuyAddress,
					sellAmount,
					slippageBps
				);
				hash = newHash;
				minBuyAmount = newMinBuyAmount;
				const retryResult = await publicClientHTTP.waitForTransactionReceipt({
					hash: hash as `0x${string}`,
				});
				result.status = retryResult.status;
			} catch (error) {
				logger.error(`Error during retry attempt ${retries}: ${error}`);
				if (retries === maxRetries) {
					throw new Error(`Transaction failed after maximum retries: ${error}`);
				}
			}
		}
	} catch (error) {
		logger.error(`Error executing swap: ${error}`);
	}
};
