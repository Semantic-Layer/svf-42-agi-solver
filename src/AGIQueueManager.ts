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
 *    - Tasks that have failed swaps after MAX_RETRIES attempts will be skipped and removed from queue
 *
 * 2. Status Flow:
 *    a. Initial State (0 - PendingDispense):
 *       - Withdraw asset from contract
 *       - Contract status becomes 1
 *
 *    b. After Withdraw (1 - DispensedPendingProceeds):
 *       - Set internal status to 3 (SwapInitiated)
 *       - Begin swap operation
 *
 *    c. Swap Initiated (3 - SwapInitiated):
 *       - Perform swap operation
 *       - Set internal status to 4 (SwapCompleted) when swap is done
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
import { depositAsset, withdrawAsset } from './utils.ts';
import { SwapError } from './errors.ts';
import { failedSwapsDB } from './db/failedSwapsDB.ts';

/**
 * Represents the result of a swap operation
 * @property agiId - The ID of the AGI that initiated the swap
 * @property amountToBuy - The amount of tokens to buy after the swap (defaults to 0)
 * @property status - The status of the swap operation (can be undefined)
 * @property attemptCount - The number of attempts made for this swap
 */
interface SwapResult {
	agiId?: number;
	amountToBuy?: number;
	status?: 'pending' | 'completed' | 'failed';
	attemptCount?: number;
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
	/** Maps AGI IDs to their extended status (combines contract and internal swap states) */
	private orderStatus: Map<number, ExtendedOrderStatus>;
	/** Maps AGI IDs to their last attempt timestamp */
	private lastAttemptTime: Map<number, number>;
	/** Maps AGI IDs to their last delay used */
	private lastDelay: Map<number, number>;
	/**
	 * Tracks the interval ID for queue checking.
	 * We need this to:
	 * 1. Prevent multiple intervals from running simultaneously
	 * 2. Stop the interval when the queue is empty
	 * 3. Clean up the interval properly to prevent memory leaks
	 */
	private checkIntervalId: NodeJS.Timeout | null = null;

	private readonly RETRY_DELAY = 1000; // 1 second delay between retries
	private readonly SWAP_RETRY_DELAY = 30000; // 30 seconds delay for swap retries
	private readonly MAX_RETRIES = 2; // Maximum number of retries
	private readonly CHECK_INTERVAL = 2000; // Check queue every second

	constructor() {
		this.swapResults = new Map();
		this.queue = [];
		this.isProcessing = false;
		this.orderStatus = new Map();
		this.lastAttemptTime = new Map();
		this.lastDelay = new Map();
	}

	/**
	 * Starts the queue checking interval if not already running.
	 *
	 * This function:
	 * 1. Checks if an interval is already running (checkIntervalId is null)
	 * 2. If no interval is running:
	 *    - Creates a new interval that runs every CHECK_INTERVAL (1 second)
	 *    - The interval checks if:
	 *      a. We're not currently processing (isProcessing is false)
	 *      b. There are tasks in the queue (queue.length > 0)
	 *    - If both conditions are met, starts processing tasks
	 *    - If the queue becomes empty, stops the interval
	 *
	 * This ensures:
	 * - Only one interval runs at a time
	 * - Tasks are processed when possible
	 * - Resources are freed when queue is empty
	 * - We respect the CHECK_INTERVAL between checks
	 */
	private startQueueCheck() {
		if (this.checkIntervalId === null) {
			this.checkIntervalId = setInterval(() => {
				if (!this.isProcessing && this.queue.length > 0) {
					this.startProcessing().catch(error => {
						logger.error(`Error in AGI processing loop: ${error}`);
					});
				} else if (this.queue.length === 0) {
					// Stop the interval if queue is empty
					this.stopQueueCheck();
				}
			}, this.CHECK_INTERVAL);
		}
	}

	private stopQueueCheck() {
		if (this.checkIntervalId !== null) {
			clearInterval(this.checkIntervalId);
			this.checkIntervalId = null;
		}
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

		// Check if task should be skipped due to max retries
		if (this.shouldSkipTask(agiId)) {
			logger.warning(`‼️  Skipping adding AGI ${agiId} to queue - exceeded max retries`);
			return;
		}

		this.queue.push(agiId);
		logger.info(`✅ Added AGI ${agiId} to queue. Queue length: ${this.queue.length}`);

		// Start checking the queue if not already running
		this.startQueueCheck();
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
			if (this.queue.length > 0) {
				const nextAgiId = this.queue[0]; // Get first item
				this.queue.push(this.queue.shift()!); // Move to end of queue
				await this.processAGI(nextAgiId);
			}
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Checks if a task should be skipped due to exceeding max retries
	 * @param agiId - The ID of the AGI to check
	 * @returns true if the task should be skipped, false otherwise
	 */
	private shouldSkipTask(agiId: number): boolean {
		const swapResult = this.swapResults.get(agiId);
		if (swapResult?.status === 'failed' && (swapResult.attemptCount || 0) >= this.MAX_RETRIES) {
			return true;
		}
		return false;
	}

	/**
	 * Processes a single AGI task.
	 * Handles the entire lifecycle of an AGI task including:
	 * - Checking if enough time has passed since last attempt
	 * - Processing the task
	 * - Handling errors and retries
	 * - Recording swap results
	 * - Managing task removal from queue
	 */
	private async processAGI(agiId: number) {
		// Check if task should be skipped due to max retries
		if (this.shouldSkipTask(agiId)) {
			logger.warning(`Skip processing AGI ${agiId} - exceeded max retries (${this.MAX_RETRIES})`);
			return;
		}

		// Check if enough time has passed since last attempt
		const lastAttempt = this.lastAttemptTime.get(agiId) || 0;
		const timeSinceLastAttempt = Date.now() - lastAttempt;
		const requiredDelay = this.lastDelay.get(agiId) || this.RETRY_DELAY;

		if (timeSinceLastAttempt < requiredDelay) {
			const secondsUntilNextAttempt = Math.ceil((requiredDelay - timeSinceLastAttempt) / 1000);
			logger.warning(
				`Skipping AGI ${agiId} - waiting ${secondsUntilNextAttempt}s (${timeSinceLastAttempt / 1000}s since last attempt, need ${requiredDelay / 1000}s)`
			);
			return;
		}

		// Record this attempt time
		this.lastAttemptTime.set(agiId, Date.now());

		let agi: AgentGeneratedIntent | undefined;

		try {
			// Get current state from contract
			agi = (await publicClientHTTP.readContract({
				address: agiContractAddress as Hex,
				abi: agiContractABI,
				functionName: 'viewAGI',
				args: [agiId],
			})) as AgentGeneratedIntent;

			// Status selection logic:
			// 1. Use contract status as primary source of truth
			// 2. Only use internal SwapCompleted status when:
			//    - Contract status is 1 (DispensedPendingProceeds)
			//    - And we have an internal status (not undefined)
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

			// If we get here, the task was successful
			// Set a standard delay for next attempt
			this.lastAttemptTime.set(agiId, Date.now());
			this.lastDelay.set(agiId, this.RETRY_DELAY);
		} catch (error) {
			const swapResult = this.swapResults.get(agiId);
			const attemptCount = swapResult?.attemptCount || 0;
			const isSwapError = error instanceof SwapError;

			// Only check max retries for swap-related errors
			if (this.shouldSkipTask(agiId)) {
				logger.error(
					`Max retries (${this.MAX_RETRIES}) exceeded for swap-related error on AGI ${agiId}, removing from queue`
				);
				const errorMessage = error instanceof Error ? error.message : String(error);

				await failedSwapsDB.recordFailedSwap(
					agiId,
					errorMessage,
					agi?.intentType ?? 0,
					agi?.assetToSell ?? '0x0',
					BigInt(agi?.amountToSell ?? 0),
					agi?.assetToBuy ?? '0x0',
					agi?.orderId ?? 0,
					agi?.orderStatus ?? 0
				);

				this.removeFromQueue(agiId);
				return;
			}

			// Determine delay based on error type
			const delay = isSwapError ? this.SWAP_RETRY_DELAY : this.RETRY_DELAY;

			// For non-swap errors, don't show the max retries in the log message
			const retryMessage = isSwapError
				? `Error processing AGI ${agiId}, retry ${attemptCount}/${this.MAX_RETRIES} in ${delay / 1000}s`
				: `Error processing AGI ${agiId}, retry ${attemptCount} in ${delay / 1000}s`;

			logger.error(retryMessage);
			logger.item(`error: ${error}`);

			// Record the current time and delay for next attempt
			this.lastAttemptTime.set(agiId, Date.now());
			this.lastDelay.set(agiId, delay);

			// No need for setTimeout - the interval will pick up the task when ready
			return;
		}
	}

	/**
	 * Handles the PendingDispense state (0)
	 * - Withdraws asset from contract
	 */
	private async handlePendingDispense(agiId: number) {
		await withdrawAsset(agiId);
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
		logger.info(`checking if swap ${agiId} is already in process`);
		const existingSwap = this.swapResults.get(agiId);
		if (existingSwap) {
			logger.info(`swap ${agiId} already in process: ${existingSwap.status}`);
			if (existingSwap.status === 'pending') {
				logger.info(`swap ${agiId} already in process, waiting...`);
				return;
			} else if (existingSwap.status === 'completed') {
				logger.info(`swap ${agiId} already completed`);
				this.orderStatus.set(agiId, ExtendedOrderStatus.SwapCompleted);
				return;
			} else if (this.shouldSkipTask(agiId)) {
				logger.warning(
					`Skip handleSwapInitiated: AGI ${agiId} failed after ${this.MAX_RETRIES} retries`
				);
				return;
			}
		} else {
			// Initialize swap result for first attempt
			logger.info(`initializing swap status as pending for AGI ${agiId}`);
			this.swapResults.set(agiId, {
				agiId,
				status: 'pending',
				attemptCount: 0,
			});
		}

		const attemptCount = (existingSwap?.attemptCount || 0) + 1;

		const currentSwap = this.swapResults.get(agiId);
		if (currentSwap) {
			this.swapResults.set(agiId, {
				...currentSwap,
				attemptCount,
			});
		}
		try {
			logger.info(`starting swap`);
			const amountToBuy = await defaultSwap({
				fromToken: agi.assetToSell,
				toToken: agi.assetToBuy,
				fromAmount: agi.amountToSell.toString(),
				fromAddress: walletClient.account!.address,
			});
			this.swapResults.set(agiId, {
				...currentSwap,
				amountToBuy: parseInt(amountToBuy),
				attemptCount: attemptCount,
				status: 'completed',
			});
			this.orderStatus.set(agiId, ExtendedOrderStatus.SwapCompleted);
			logger.info(`AGI ${agiId} swap completed`);
		} catch (error) {
			this.swapResults.set(agiId, {
				...currentSwap,
				amountToBuy: 0,
				attemptCount: attemptCount,
				status: 'failed',
			});
			logger.error(`AGI ${agiId} swap failed: ${error} at attempt ${attemptCount}`);
			throw new SwapError(`Swap failed for AGI ${agiId} at attempt ${attemptCount}`, error);
		}
	}

	/**
	 * Handles the SwapCompleted state (4)
	 * - Deposits swapped assets back to contract
	 */
	private async handleSwapCompleted(agiId: number) {
		const swapResult = this.swapResults.get(agiId);
		if (swapResult) {
			await depositAsset(agiId, swapResult.amountToBuy ?? 0);
			this.orderStatus.set(agiId, ExtendedOrderStatus.ProceedsReceived);

			// If an attempt is successful, we should delete the corresponding failure record from the database.
			// Ideally, every swap we perform should be successful, with no records of failure in the database,
			// so attempting to delete data here would add extra search time.
			// This is acceptable because the query time for a very small number of data entries is at the millisecond level.
			await failedSwapsDB.tryDeleteFailedSwap(agiId);
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

	private removeFromQueue(agiId: number) {
		const index = this.queue.indexOf(agiId);
		if (index > -1) {
			this.queue.splice(index, 1);
			// this.orderStatus.delete(agiId);
			// this.swapResults.delete(agiId);
			this.lastAttemptTime.delete(agiId);
			this.lastDelay.delete(agiId);

			// Stop checking if queue is empty
			if (this.queue.length === 0) {
				this.stopQueueCheck();
			}
		}
	}

	/**
	 * Returns the count and IDs of tasks that failed after reaching max retry attempts
	 * @returns {count: number, ids: number[]} The count and IDs of tasks that failed after MAX_RETRIES attempts
	 */
	getfailedSwapTask() {
		const failedTasks = Array.from(this.swapResults.entries())
			.filter(([agiId]) => this.shouldSkipTask(agiId))
			.map(([agiId]) => agiId);
		return {
			count: failedTasks.length,
			ids: failedTasks,
		};
	}
}

// Create a single instance
export const agiQueueManager = new AGIQueueManager();
