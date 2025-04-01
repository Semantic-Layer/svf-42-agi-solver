/**
 * AGI Queue Manager
 *
 * Manages the queue of AGIs (Agent Generated Intents) for processing.
 *
 * Order Processing Flow:
 * 1. Queue Management:
 *    - Items are added to queue via add(agiId)
 *    - When processing starts, items are moved to end of queue before processing
 *    - Items are only removed from queue when fully completed (status 2)
 *
 * 2. Status Flow:
 *    a. Initial State (0 - PendingDispense):
 *       - Withdraw asset from contract
 *       - Contract status becomes 1
 *
 *    b. After Withdraw (1 - DispensedPendingProceeds):
 *       - Set internal status to 4 (SwapInitiated)
 *       - Begin swap operation
 *
 *    c. Swap Initiated (3 - SwapInitiated):
 *       - Perform swap operation
 *       - Set internal status to 3 (SwapCompleted) when swap is done
 *
 *    d. After Swap (4 - SwapCompleted):
 *       - Deposit swapped assets back to contract
 *       - Set internal status to 2 (ProceedsReceived)
 *
 *    e. Final State (2 - ProceedsReceived):
 *       - Clean up internal state
 *       - Remove from queue
 *
 * 3. Status Selection Logic:
 *    - Use contract status as primary source of truth
 *    - Only use internal SwapCompleted status when:
 *      * Contract status is 1 (DispensedPendingProceeds)
 *      * AND we have an internal status (not undefined)
 *
 * 4. Transaction Handling:
 *    - Wait for transaction confirmation before proceeding
 *    - Handle transaction failures gracefully
 *    - Keep items in queue until fully processed
 *
 * 5. Queue Processing:
 *    - Process one item at a time
 *    - Move items to end of queue before processing
 *    - Only remove items when fully completed
 *    - Maintain FIFO order while allowing other items to be processed
 */

import { walletClient, publicClientHTTP, agiContractAddress, agiContractABI } from './clients.ts';
import { type Hex } from 'viem';
import { type AgentGeneratedIntent } from './types.ts';
import { logger } from './logger.ts';
import { defaultSwap } from './swap/lifiSwap.ts';

/**
 * Represents the result of a swap operation
 * @property agiId - The ID of the AGI that initiated the swap
 * @property amountToBuy - The amount of tokens to buy after the swap
 * @property status - The status of the swap operation
 */
interface SwapResult {
	agiId: number;
	amountToBuy: number;
	status: 'pending' | 'completed' | 'failed';
}

/**
 * Extended order status that combines contract states with internal processing states
 * The contract only tracks states 0,1,2, while we add states 3,4 to track the swap completion
 */
const ExtendedOrderStatus = {
	PendingDispense: 0, // Contract: Initial state, waiting to withdraw asset
	DispensedPendingProceeds: 1, // Contract: Asset withdrawn, ready for swap
	SwapInitiated: 3, // Internal: Swap operation started
	SwapCompleted: 4, // Internal: Swap done, ready to deposit proceeds
	ProceedsReceived: 2, // Contract: Final state, all operations completed
} as const;

type ExtendedOrderStatus = (typeof ExtendedOrderStatus)[keyof typeof ExtendedOrderStatus];

/**
 * Helper function to get the status name from a numeric status
 * @param status - The numeric status value
 * @returns The name of the status or 'Unknown' if not found
 */
function getStatusName(status: number): string {
	const statusEntry = Object.entries(ExtendedOrderStatus).find(([, value]) => value === status);
	return statusEntry ? statusEntry[0] : 'Unknown';
}

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
	 * 0 (PendingDispense) -> 1 (DispensedPendingProceeds) -> 3 (SwapInitiated) -> 4 (SwapCompleted) -> 2 (ProceedsReceived)
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

			// Status selection logic:
			// 1. Use contract status as primary source of truth
			// 2. Only use internal SwapCompleted status when:
			//    - Contract status is 1 (DispensedPendingProceeds)
			//    - AND we have an internal status (not undefined)
			let currentStatus: ExtendedOrderStatus;

			if (
				agi.orderStatus === ExtendedOrderStatus.DispensedPendingProceeds &&
				this.orderStatus.get(agiId)
			) {
				// Contract is ready for deposit (1) and we have an internal status
				currentStatus = this.orderStatus.get(agiId)!;
			} else {
				// Use contract's status for everything else
				currentStatus = agi.orderStatus as ExtendedOrderStatus;
			}

			logger.item(`Contract Status: ${agi.orderStatus} (${getStatusName(agi.orderStatus)})`);
			logger.item(`Extended Status: ${currentStatus} (${getStatusName(currentStatus)})`);

			// Process based on current status
			switch (currentStatus) {
				case ExtendedOrderStatus.PendingDispense:
					await this.handlePendingDispense(agiId);
					break;
				case ExtendedOrderStatus.DispensedPendingProceeds:
					await this.handleDispensedPendingProceeds(agiId);
					break;
				case ExtendedOrderStatus.SwapInitiated:
					await this.handleSwapInitiated(agiId, agi);
					break;
				case ExtendedOrderStatus.SwapCompleted:
					await this.handleSwapCompleted(agiId);
					break;
				case ExtendedOrderStatus.ProceedsReceived:
					await this.handleProceedsReceived(agiId);
					break;
			}
		} catch (error) {
			logger.error(`Error processing AGI ${agiId}: ${error}`);
			throw error;
		}
	}

	/**
	 * Handles the PendingDispense state (0)
	 * - Withdraws asset from contract
	 */
	private async handlePendingDispense(agiId: number) {
		await this.withdrawAsset(agiId);
	}

	/**
	 * Handles the DispensedPendingProceeds state (1)
	 * - Sets status to SwapInitiated and begins swap
	 */
	private async handleDispensedPendingProceeds(agiId: number) {
		this.orderStatus.set(agiId, ExtendedOrderStatus.SwapInitiated);
		logger.info(`AGI ${agiId} swap initiated`);
	}

	/**
	 * Handles the SwapInitiated state (3)
	 * - Performs swap and stores result
	 */
	private async handleSwapInitiated(agiId: number, agi: AgentGeneratedIntent) {
		// Check if swap is already in process
		logger.info(`checking if swap is already in process`);
		const existingSwap = this.swapResults.get(agiId);
		if (existingSwap) {
			logger.info(`swap already in process: ${existingSwap.status}`);
			if (existingSwap.status === 'pending') {
				logger.info(`AGI ${agiId} swap already in process, waiting...`);
				return;
			} else if (existingSwap.status === 'completed') {
				logger.info(`AGI ${agiId} swap already completed`);
				this.orderStatus.set(agiId, ExtendedOrderStatus.SwapCompleted);
				return;
			}
		}

		// Initialize swap as pending
		logger.info(`initializing swap as pending`);
		this.swapResults.set(agiId, { agiId, amountToBuy: 0, status: 'pending' });

		try {
			logger.info(`starting swap`);
			const amountToBuy = await defaultSwap({
				fromToken: agi.assetToSell,
				toToken: agi.assetToBuy,
				fromAmount: agi.amountToSell.toString(),
				fromAddress: walletClient.account!.address,
			});
			this.swapResults.set(agiId, {
				agiId,
				amountToBuy: parseInt(amountToBuy),
				status: 'completed',
			});
			this.orderStatus.set(agiId, ExtendedOrderStatus.SwapCompleted);
			logger.info(`AGI ${agiId} swap completed`);
		} catch (error) {
			this.swapResults.set(agiId, { agiId, amountToBuy: 0, status: 'failed' });
			logger.error(`AGI ${agiId} swap failed: ${error}`);
			throw error;
		}
	}

	/**
	 * Handles the SwapCompleted state (4)
	 * - Deposits swapped assets back to contract
	 */
	private async handleSwapCompleted(agiId: number) {
		const swapResult = this.swapResults.get(agiId);
		if (swapResult) {
			await this.depositAsset(agiId, swapResult.amountToBuy);
			this.orderStatus.set(agiId, ExtendedOrderStatus.ProceedsReceived);
		}
	}

	/**
	 * Handles the ProceedsReceived state (2)
	 * - Cleans up internal state and removes from queue
	 */
	private async handleProceedsReceived(agiId: number) {
		logger.success(`AGI ${agiId} already processed`);
		this.orderStatus.delete(agiId);
		logger.item(`removing task from queue: ${agiId}`);
		const index = this.queue.indexOf(agiId);
		if (index > -1) {
			this.queue.splice(index, 1);
		}
	}

	/**
	 * Withdraws the asset to sell from the contract
	 * @param orderIndex - The ID of the AGI to withdraw for
	 */
	private async withdrawAsset(orderIndex: number) {
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
