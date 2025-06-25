import { AlphaRouter, SwapOptionsSwapRouter02, SwapType } from '@uniswap/smart-order-router';
import { CurrencyAmount, Percent, TradeType, Token } from '@uniswap/sdk-core';
import { chainId, walletClient, publicClientHTTP, IERC20ABI } from '../clients.ts';
import logger from '../logger.ts';
import { NoRoutesFoundError } from '../errors.ts';
import { formatEther, Hex } from 'viem';
import { providers } from 'ethers';

interface SwapParams {
	chainId: number;
	fromToken: Token;
	toToken: Token;
	fromAmount: string;
	fromAddress: string;
	options: SwapOptionsSwapRouter02;
}

interface DefaultSwapParams {
	fromToken: string;
	toToken: string;
	fromAmount: string;
	fromAddress: string;
	options?: SwapOptionsSwapRouter02;
}

// Initialize ethers provider
const provider = new providers.JsonRpcProvider(process.env.RPC);

// Initialize the AlphaRouter
const router = new AlphaRouter({
	chainId: chainId,
	provider: provider,
});

// Helper function to create a Token instance
function createToken(address: string): Token {
	return new Token(chainId, address, 18); // Assuming all tokens are 18 decimals
}

// Helper function to approve ERC20 tokens
async function approveERC20(tokenAddress: string, spenderAddress: string, amount: string) {
	logger.info(`Approving ${amount} tokens for spender ${spenderAddress}`);

	const { request } = await publicClientHTTP.simulateContract({
		address: tokenAddress as Hex,
		abi: IERC20ABI,
		functionName: 'approve',
		args: [spenderAddress as Hex, BigInt(amount)],
		account: walletClient.account!,
	});

	const hash = await walletClient.writeContract(request);

	logger.info(`Approval transaction hash: ${hash}`);

	// Wait for the transaction to be mined
	const receipt = await publicClientHTTP.waitForTransactionReceipt({ hash });

	if (receipt.status === 'reverted') {
		throw new Error('Approval transaction failed');
	}

	logger.info('Token approval successful');
}

async function swap({ chainId, fromToken, toToken, fromAmount, fromAddress, options }: SwapParams) {
	logger.table('Uniswap Routes', {
		chainId: chainId,
		fromToken: fromToken.address,
		toToken: toToken.address,
		amount: `${formatEther(BigInt(fromAmount))} e18`,
		fromAddress: fromAddress,
		options: `${JSON.stringify(options)}`,
	});

	// Get the route
	const route = await router.route(
		CurrencyAmount.fromRawAmount(fromToken, fromAmount),
		toToken,
		TradeType.EXACT_INPUT,
		options
	);

	if (!route || !route.methodParameters) {
		throw new NoRoutesFoundError();
	}

	logger.info(`routes found: ${route.route.length}`);
	logger.item(`best route: ${JSON.stringify(route.route[0], null, 2)}`);
	logger.item(
		`best route steps: ${route.route[0].protocol === 'V2' ? 1 : route.route[0].tokenPath.length - 1}`
	);
	logger.item(`options: ${JSON.stringify(options, null, 2)}`);

	// Approve the router to spend tokens
	if (fromToken.address !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
		// Not ETH
		await approveERC20(
			fromToken.address,
			// TODO approve which? '0x2626664c2603336E57B271c5C0b26F421741e481' or route.methodParameters.to
			route.methodParameters.to,
			fromAmount
		);
	}

	// Execute the trade
	const execution = await walletClient.sendTransaction({
		chain: walletClient.chain,
		account: walletClient.account!,
		data: route.methodParameters.calldata as Hex,
		to: route.methodParameters.to as Hex,
		value: BigInt(route.methodParameters.value),
		from: fromAddress,
	});

	if (!execution) {
		throw new Error('Transaction failed');
	}

	return route.quote.toFixed();
}

export async function defaultSwap({
	fromToken: fromTokenAddress,
	toToken: toTokenAddress,
	fromAmount,
	fromAddress,
	options = {
		recipient: fromAddress,
		slippageTolerance: new Percent(50, 10_000), // 0.5%
		deadline: Math.floor(Date.now() / 1000 + 1800), // 30 minutes
		type: SwapType.SWAP_ROUTER_02,
	},
}: DefaultSwapParams) {
	const fromToken = createToken(fromTokenAddress);
	const toToken = createToken(toTokenAddress);

	const execution = await swap({
		chainId: chainId,
		fromToken,
		toToken,
		fromAmount,
		fromAddress,
		options,
	});

	return execution;
}
