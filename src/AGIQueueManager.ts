import { walletClient, publicClientHTTP, agiContractAddress, agiContractABI } from './clients';
import { Hex } from 'viem';
import { mockSwap } from './mockSwap';
import { AgentGeneratedIntent } from './types';
import { logger } from './logger';

interface SwapResult {
	agiId: number;
	amountToBuy: number;
}

export class AGIQueueManager {
	private processingSet: Set<number>;
	private swapResults: Map<number, SwapResult>;
	private isProcessing: boolean;

	constructor() {
		this.processingSet = new Set();
		this.swapResults = new Map();
		this.isProcessing = false;
		this.startProcessing();
	}

	private async startProcessing() {
		if (this.isProcessing) return;
		this.isProcessing = true;
		logger.process('Starting AGI Queue Processing');

		while (this.isProcessing) {
			try {
				// Small delay to prevent tight loop
				await new Promise(resolve => setTimeout(resolve, 100));
			} catch (error) {
				logger.error(`Error in processing loop: ${error}`);
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		}
	}

	async processAGI(agiId: number) {
		if (this.processingSet.has(agiId)) {
			logger.warning(`AGI ${agiId} is already being processed`);
			return;
		}
		this.processingSet.add(agiId);
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
				// State 0 -> 1: Withdraw asset
				await this.withdrawAsset(agiId);
				logger.success(`Successfully withdrew asset for AGI ${agiId}`);
			} else if (agi.orderStatus === 1) {
				// State 1 -> 2: Check if we already have swap result
				const swapResult = this.swapResults.get(agiId);
				if (swapResult) {
					logger.process(`Processing AGI ${agiId}: Using existing swap result`);
					// If we have swap result, just do the deposit
					await this.depositAsset(agiId, swapResult.amountToBuy);
				} else {
					logger.process(`Processing AGI ${agiId}: Performing new swap`);
					// If no swap result, do the swap first
					const amountToBuy = await mockSwap(agi.assetToSell, agi.amountToSell, agi.assetToBuy);
					// Store the swap result
					this.swapResults.set(agiId, { agiId, amountToBuy });
					logger.success(`Swap completed for AGI ${agiId}: ${amountToBuy} ${agi.assetToBuy}`);
					// Do the deposit
					await this.depositAsset(agiId, amountToBuy);
				}
			}
		} catch (error) {
			logger.error(`Error processing AGI ${agiId}: ${error}`);
			// Let the caller handle retries if needed
		} finally {
			this.processingSet.delete(agiId);
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
			logger.success(`Successfully withdrew asset for AGI ${orderIndex}`);
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
			logger.success(`Successfully deposited asset for AGI ${orderIndex}`);
			// If deposit succeeds, remove the swap result
			this.swapResults.delete(orderIndex);
		} catch (error) {
			logger.error(`Error depositing asset for AGI ${orderIndex}: ${error}`);
			// If deposit fails, keep the swap result in the map
			// This way, next time we process this AGI, we'll use the same swap result
			throw error;
		}
	}
}

export const agiQueueManager = new AGIQueueManager();
