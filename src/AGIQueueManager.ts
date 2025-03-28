import { walletClient, publicClientHTTP, agiContractAddress, agiContractABI } from './clients.ts';
import { type Hex } from 'viem';
import { mockSwap } from './mockSwap.ts';
import { type AgentGeneratedIntent } from './types.ts';
import { logger } from './logger.ts';

/**
 * Represents the result of a swap operation
 * @property agiId - The ID of the AGI that initiated the swap
 * @property amountToBuy - The amount of tokens to buy after the swap
 */
interface SwapResult {
	agiId: number;
	amountToBuy: number;
}

/**
 * Extended order status that combines contract states with internal processing states
 * The contract only tracks states 0,1,2, while we add state 3 to track the swap completion
 */
const ExtendedOrderStatus = {
	PendingDispense: 0, // Contract: Initial state, waiting to withdraw asset
	DispensedPendingProceeds: 1, // Contract: Asset withdrawn, ready for swap
	SwapCompleted: 3, // Internal: Swap done, ready to deposit proceeds
	ProceedsReceived: 2, // Contract: Final state, all operations completed
} as const;

type ExtendedOrderStatus = (typeof ExtendedOrderStatus)[keyof typeof ExtendedOrderStatus];

/**
 * Manages the queue of AGIs (Agent Generated Intents) for processing.
 * Implements a FIFO (First In First Out) queue with special handling for incomplete items:
 * - When an item is processed, it's moved to the end of the queue
 * - If processing completes successfully (status 2), the item is removed
 * - If processing is incomplete or fails, the item stays at the end, allowing other items to be processed first
 * - This ensures fair processing while maintaining order
 *
 * The queue is designed to handle transaction latency:
 * - Items are moved to the end of queue before processing
 * - This allows other items to be processed while waiting for transactions to land on-chain
 * - Only removes items when their completion (status 2) is confirmed on-chain
 * - Prevents blocking on transaction confirmations while maintaining FIFO order
 */
export class AGIQueueManager {
	/** Maps AGI IDs to their swap results */
	private swapResults: Map<number, SwapResult>;
	/** Queue of AGI IDs waiting to be processed */
	private queue: number[];
	/** Flag to prevent concurrent processing */
	private isProcessing: boolean;
	/** Maps AGI IDs to their extended status (combines contract and internal states) */
	private orderStatus: Map<number, ExtendedOrderStatus>;

	constructor() {
		this.swapResults = new Map();
		this.queue = [];
		this.isProcessing = false;
		this.orderStatus = new Map();
	}

	/**
	 * Adds an AGI to the processing queue
	 * @param agiId - The ID of the AGI to process
	 */
	add(agiId: number) {
		if (this.queue.includes(agiId)) {
			logger.warning(`AGI ${agiId} is already in queue`);
			return;
		}
		this.queue.push(agiId);
		logger.info(`Added AGI ${agiId} to queue. Queue length: ${this.queue.length}`);

		// Start processing if not already processing and queue is not empty
		if (!this.isProcessing && this.queue.length > 0) {
			// Handle the promise to prevent uncaught exceptions
			this.startProcessing().catch(error => {
				logger.error(`Error in AGI processing loop: ${error}`);
			});
		}
	}

	/**
	 * Starts processing AGIs in the queue.
	 * Implements a FIFO queue with special handling:
	 * 1. For each item in the queue:
	 *    - Peek at the first item
	 *    - Move it to the end of queue immediately
	 *    - Process the item
	 * 2. If processing completes successfully (status 2):
	 *    - Item is removed from queue in processAGI
	 * 3. If processing is incomplete or fails:
	 *    - Item remains at the end of queue
	 *    - Next iteration will process other items first
	 *
	 * This design handles transaction latency by:
	 * - Moving items to queue end before processing
	 * - Allowing other items to be processed while waiting for transactions
	 * - Only removing items when their completion is confirmed on-chain
	 */
	private async startProcessing() {
		if (this.isProcessing) return;
		this.isProcessing = true;

		try {
			while (this.queue.length > 0) {
				const nextAgiId = this.queue[0]; // Peek at first item
				this.queue.push(this.queue.shift()!); // Move to end of queue before processing
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

	/**
	 * Processes a single AGI through its lifecycle.
	 * Status transitions:
	 * 0 (PendingDispense) -> 1 (DispensedPendingProceeds) -> 3 (SwapCompleted) -> 2 (ProceedsReceived)
	 *
	 * Queue handling:
	 * - If AGI completes (status 2), it's removed from queue
	 * - If AGI is incomplete or fails, it remains at queue end (moved there in startProcessing)
	 * - This allows other items to be processed while maintaining FIFO order
	 *
	 * Transaction handling:
	 * - Only removes items when their completion (status 2) is confirmed on-chain
	 * - This ensures we don't prematurely remove items while transactions are pending
	 * - Other items can be processed while waiting for transaction confirmations
	 */
	private async processAGI(agiId: number) {
		logger.info(`Processing AGI ${agiId}`);

		try {
			// Get current state from contract
			const agi = (await publicClientHTTP.readContract({
				address: agiContractAddress as Hex,
				abi: agiContractABI,
				functionName: 'viewAGI',
				args: [agiId],
			})) as AgentGeneratedIntent;

			// If contract shows finished (2), use that. Otherwise use our internal status if it exists
			const currentStatus =
				agi.orderStatus === ExtendedOrderStatus.ProceedsReceived
					? ExtendedOrderStatus.ProceedsReceived
					: this.orderStatus.get(agiId) || agi.orderStatus;
			logger.item(`Contract Status: ${agi.orderStatus}`);
			logger.item(`Extended Status: ${currentStatus}`);

			// Process based on current status
			switch (currentStatus) {
				case ExtendedOrderStatus.PendingDispense:
					// Withdraw asset from contract
					await this.withdrawAsset(agiId);
					break;
				case ExtendedOrderStatus.DispensedPendingProceeds:
					// Perform swap and store result
					const amountToBuy = await mockSwap(agi.assetToSell, agi.amountToSell, agi.assetToBuy);
					this.swapResults.set(agiId, { agiId, amountToBuy });
					this.orderStatus.set(agiId, ExtendedOrderStatus.SwapCompleted);
					break;
				case ExtendedOrderStatus.SwapCompleted:
					// Deposit swapped assets back to contract
					const swapResult = this.swapResults.get(agiId);
					if (swapResult) {
						await this.depositAsset(agiId, swapResult.amountToBuy);
						this.orderStatus.set(agiId, ExtendedOrderStatus.ProceedsReceived);
					}
					break;
				case ExtendedOrderStatus.ProceedsReceived:
					// AGI is fully processed, clean up internal state
					logger.success(`AGI ${agiId} already processed`);
					this.orderStatus.delete(agiId);
					// Find and remove the completed item from queue
					logger.item(`removing task from queue: ${agiId}`);
					const index = this.queue.indexOf(agiId);
					if (index > -1) {
						this.queue.splice(index, 1);
					}
					return;
			}
		} catch (error) {
			logger.error(`Error processing AGI ${agiId}: ${error}`);
			throw error;
		}
	}

	/**
	 * Withdraws the asset to sell from the contract
	 * @param orderIndex - The ID of the AGI to withdraw for
	 */
	private async withdrawAsset(orderIndex: number) {
		console.log('account to withdraw', walletClient.account.address);
		try {
			logger.process(`Withdrawing asset for AGI ${orderIndex}`);
			const { request } = await publicClientHTTP.simulateContract({
				account: walletClient.account,
				address: agiContractAddress as Hex,
				abi: agiContractABI,
				functionName: 'withdrawAsset',
				args: [orderIndex],
			});

			await walletClient.writeContract(request);
			logger.success(`txn success: withdrew asset for AGI ${orderIndex}`);
		} catch (error) {
			logger.error(`Error withdrawing asset for AGI ${orderIndex}: ${error}`);
			throw error;
		}
	}

	/**
	 * Deposits the swapped assets back to the contract
	 * @param orderIndex - The ID of the AGI to deposit for
	 * @param amount - The amount of tokens to deposit
	 */
	private async depositAsset(orderIndex: number, amount: number) {
		try {
			logger.process(`Depositing ${amount} for AGI ${orderIndex}`);
			const { request } = await publicClientHTTP.simulateContract({
				account: walletClient.account,
				address: agiContractAddress as Hex,
				abi: agiContractABI,
				functionName: 'depositAsset',
				args: [orderIndex, amount],
			});

			await walletClient.writeContract(request);
			logger.success(`txn success: deposited asset for AGI ${orderIndex}`);
			this.swapResults.delete(orderIndex);
		} catch (error) {
			logger.error(`Error depositing asset for AGI ${orderIndex}: ${error}`);
			throw error;
		}
	}
}
