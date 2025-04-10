import { createConfig, EVM, executeRoute, getRoutes, RouteOptions } from '@lifi/sdk';
import { chainId, walletClient } from '../clients.ts';
import logger from '../logger.ts';
import { NoRoutesFoundError } from '../errors.ts';
import { formatEther } from 'viem';

interface SwapParams {
	chainId: number;
	fromToken: string;
	toToken: string;
	fromAmount: string;
	fromAddress: string;
	options: RouteOptions;
}

interface DefaultSwapParams {
	fromToken: string;
	toToken: string;
	fromAmount: string;
	fromAddress: string;
	options?: RouteOptions;
}

// https://docs.li.fi/integrate-li.fi-sdk/configure-sdk-providers// https://docs.li.fi/integrate-li.fi-sdk/configure-sdk-providers
createConfig({
	integrator: 'svf42',
	providers: [
		EVM({
			getWalletClient: async () => walletClient,
		}),
	],
});

async function swap({ chainId, fromToken, toToken, fromAmount, fromAddress, options }: SwapParams) {
	logger.table('LiFi Routes', {
		chainId: chainId,
		fromToken: fromToken,
		toToken: toToken,
		amount: `${formatEther(BigInt(fromAmount))} e18`,
		fromAddress: fromAddress,
		options: `${JSON.stringify(options)}`,
	});
	const result = await getRoutes({
		fromChainId: chainId,
		toChainId: chainId,
		fromTokenAddress: fromToken,
		toTokenAddress: toToken,
		fromAmount: fromAmount,
		fromAddress: fromAddress,
		options: options,
	});

	if (!result.routes.length) {
		throw new NoRoutesFoundError();
	}

	logger.info(`routes found: ${result.routes.length}`);
	logger.item(`best route: ${JSON.stringify(result.routes[0], null, 2)}`);
	logger.item(`best route steps: ${result.routes[0].steps.length}`);
	logger.item(`options: ${JSON.stringify(options, null, 2)}`);

	const route = result.routes[0];

	const execution = await executeRoute(route);
	const process = execution.steps[0]?.execution?.process[0];

	if (!process?.status || process.status === 'FAILED') {
		throw new Error('Transaction failed');
	}
	return execution;
}

export async function defaultSwap({
	fromToken,
	toToken,
	fromAmount,
	fromAddress,
	options = {
		slippage: 0.05, // 5%
		order: 'RECOMMENDED',
	},
}: DefaultSwapParams) {
	const execution = await swap({
		chainId: chainId,
		fromToken,
		toToken,
		fromAmount,
		fromAddress,
		options,
	});

	const buyAmount = execution.toAmount;
	return buyAmount;
}
