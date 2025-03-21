import { Order, State } from '../types';
import { BaseState } from './BaseState';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { Mock13ABI } from '../utils/contractLoader';

export class SellAssetState extends BaseState {
	private retryCount: number = 0;
	private readonly MAX_RETRIES: number = 20;
	private readonly RETRY_DELAY: number = 50000; // 50 seconds

	private readonly abi = Mock13ABI;

	// Mock LiFi Router address on Base Sepolia
	private readonly MOCK_LIFI_ROUTER = '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae' as const;

	async enter(): Promise<void> {
		console.log('Entering SELL_ASSET state');
		this.retryCount = 0;
	}

	async exit(): Promise<void> {
		console.log('Exiting SELL_ASSET state');
	}

	private async mockLiFiSwap(
		fromToken: string,
		toToken: string,
		amount: bigint,
		walletClient: any,
		publicClient: any,
		account: any
	): Promise<void> {
		console.log(`Simulating LiFi swap from ${fromToken} to ${toToken} for amount ${amount}`);

		// Mock delay to simulate swap
		await this.delay(2000);

		// Mock successful swap
		console.log('LiFi swap completed successfully');
	}

	async handleOrder(order: Order): Promise<boolean> {
		try {
			if (order.orderStatus !== 0) {
				throw new Error('Order must be in pending dispense status');
			}

			// Create Viem clients
			const publicClient = createPublicClient({
				chain: baseSepolia,
				transport: http(),
			});

			const account = privateKeyToAccount(this.context.getPrivateKey() as `0x${string}`);
			const walletClient = createWalletClient({
				account,
				chain: baseSepolia,
				transport: http(),
			});

			// Step 1: Withdraw the asset to sell
			const { request: withdrawRequest } = await publicClient.simulateContract({
				address: this.context.getContractAddress() as `0x${string}`,
				abi: this.abi,
				functionName: 'withdrawAsset',
				args: [BigInt(order.amount), BigInt(order.orderId)],
				account,
			});

			const withdrawHash = await walletClient.writeContract(withdrawRequest);
			await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

			// Step 2: Mock LiFi Swap
			await this.mockLiFiSwap(
				order.assetToSell.address,
				this.context.SVF_TOKEN,
				BigInt(order.amount),
				walletClient,
				publicClient,
				account
			);

			// Update order status after successful swap
			order.orderStatus = 1;

			// Step 3: Deposit SVF tokens
			const { request: depositRequest } = await publicClient.simulateContract({
				address: this.context.getContractAddress() as `0x${string}`,
				abi: this.abi,
				functionName: 'depositSVF',
				args: [BigInt(order.amount), BigInt(order.orderId)],
				account,
			});

			const depositHash = await walletClient.writeContract(depositRequest);
			await publicClient.waitForTransactionReceipt({ hash: depositHash });

			return this.context.returnToIdle();
		} catch (error) {
			console.error('Error in SellAssetState:', error);

			if (this.retryCount >= this.MAX_RETRIES) {
				await this.context.transitionToState(State.HANDLE_FATAL_ERROR);
				return false;
			}

			this.retryCount++;
			await this.context.transitionToState(State.LOG_ERROR);
			await this.delay(this.RETRY_DELAY);
			return false;
		}
	}

	getName(): State {
		return State.SELL_ASSET;
	}
}
