import { createConfig, EVM, executeRoute, getRoutes, RouteOptions } from '@lifi/sdk';
import { walletClient } from '../clients.ts';

export interface SwapParams {
	chainId: number;
	fromToken: string;
	toToken: string;
	fromAmount: string;
	fromAddress: string;
	options: RouteOptions;
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

export async function swap({
	chainId,
	fromToken,
	toToken,
	fromAmount,
	fromAddress,
	options,
}: SwapParams) {
	const result = await getRoutes({
		fromChainId: chainId,
		toChainId: chainId,
		fromTokenAddress: fromToken,
		toTokenAddress: toToken,
		fromAmount: fromAmount,
		fromAddress: fromAddress,
		options: options,
	});

	if (!result.routes.length) throw new Error('No routes found');

	const route = result.routes[0];

	const execution = await executeRoute(route);
	const process = execution.steps[0]?.execution?.process[0];

	if (!process?.status || process.status === 'FAILED') {
		throw new Error('Transaction failed');
	}
	return execution;
}
