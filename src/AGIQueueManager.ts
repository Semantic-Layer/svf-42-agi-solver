import { walletClient, publicClientHTTP, agiContractAddress, agiContractABI } from './clients.ts';
import { type Hex } from 'viem';
import { mockSwap } from './mockSwap.ts';
import { type AgentGeneratedIntent } from './types.ts';
import { logger } from './logger.ts';

interface SwapResult {
	agiId: number;
	amountToBuy: number;
}

export class AGIQueueManager {
	private swapResults: Map<number, SwapResult>;
	private queue: number[]; // Queue of AGI IDs to process
	private isProcessing: boolean;

	constructor() {
		this.swapResults = new Map();
		this.queue = [];
		this.isProcessing = false;
	}

	add(agiId: number) {
		if (this.queue.includes(agiId)) {
			logger.warning(`AGI ${agiId} is already in queue`);
			return;
		}
		this.queue.push(agiId);
		logger.info(`Added AGI ${agiId} to queue. Queue length: ${this.queue.length}`);

		// Start processing if not already processing
		if (!this.isProcessing) {
			// Handle the promise to prevent uncaught exceptions
			this.startProcessing().catch(error => {
				logger.error(`Error in AGI processing loop: ${error}`);
			});
		}
	}

	private async startProcessing() {
		if (this.isProcessing) return;
		this.isProcessing = true;

		try {
			while (this.queue.length > 0) {
				const nextAgiId = this.queue.shift()!;
				try {
					await this.processAGI(nextAgiId);
				} catch (error) {
					logger.error(`Error processing AGI ${nextAgiId}: ${error}`);
				}
			}
		} finally {
			this.isProcessing = false;
		}
	}

	private async processAGI(agiId: number) {
		logger.info(`Starting to process AGI ${agiId}`);

		try {
			const agi = (await publicClientHTTP.readContract({
				address: agiContractAddress as Hex,
				abi: agiContractABI,
				functionName: 'viewAGI',
				args: [agiId],
			})) as AgentGeneratedIntent;

			logger.item(`AGI ${agiId} current status: ${agi.orderStatus}`);

			if (agi.orderStatus === 0) {
				logger.process(`Processing AGI ${agiId}: Withdrawing asset`);
				await this.withdrawAsset(agiId);
				logger.success(`Successfully process: withdrew asset for AGI ${agiId}`);
			} else if (agi.orderStatus === 1) {
				const swapResult = this.swapResults.get(agiId);
				if (swapResult) {
					logger.process(`Processing AGI ${agiId}: Using existing swap result`);
					await this.depositAsset(agiId, swapResult.amountToBuy);
				} else {
					logger.process(`Processing AGI ${agiId}: Performing new swap`);
					const amountToBuy = await mockSwap(agi.assetToSell, agi.amountToSell, agi.assetToBuy);
					this.swapResults.set(agiId, { agiId, amountToBuy });
					logger.success(`Swap completed for AGI ${agiId}: ${amountToBuy} ${agi.assetToBuy}`);
					await this.depositAsset(agiId, amountToBuy);
				}
			}
		} finally {
			logger.info(`Finished processing AGI ${agiId}`);
		}
	}

	private async withdrawAsset(orderIndex: number) {
		try {
			logger.process(`Withdrawing asset for AGI ${orderIndex}`);
			await walletClient.writeContract({
				address: agiContractAddress as Hex,
				abi: agiContractABI,
				functionName: 'withdrawAsset',
				args: [orderIndex],
				chain: null,
				account: null,
			});
			logger.success(`txn success: withdrew asset for AGI ${orderIndex}`);
		} catch (error) {
			logger.error(`Error withdrawing asset for AGI ${orderIndex}: ${error}`);
			throw error;
		}
	}

	private async depositAsset(orderIndex: number, amount: number) {
		try {
			logger.process(`Depositing ${amount} for AGI ${orderIndex}`);
			await walletClient.writeContract({
				address: agiContractAddress as Hex,
				abi: agiContractABI,
				functionName: 'depositAsset',
				args: [orderIndex, amount],
				chain: null,
				account: null,
			});
			logger.success(`txn success: deposited asset for AGI ${orderIndex}`);
			this.swapResults.delete(orderIndex);
		} catch (error) {
			logger.error(`Error depositing asset for AGI ${orderIndex}: ${error}`);
			throw error;
		}
	}
}
