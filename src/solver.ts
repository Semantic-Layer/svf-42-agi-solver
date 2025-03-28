import logger from './logger.ts';
import {
	agiContractABI,
	agiContractAddress,
	publicClientHTTP,
	publicClientWSS,
} from './clients.ts';
import { type Hex } from 'viem';
import { AGIQueueManager } from './AGIQueueManager.ts';

// Create a single instance
const agiQueueManager = new AGIQueueManager();

// call the contract function getProcessedAGIs
const BATCH_SIZE = 50;
const getProcessedAGIIds = async (startIndex: number, endIndex: number) => {
	const result: number[] = [];
	const totalBatches = Math.ceil((endIndex - startIndex + 1) / BATCH_SIZE);
	logger.info(`BATCH PROCESSING: Retrieving processed tasks in ${totalBatches} batches`);

	for (let i = startIndex; i <= endIndex; i += BATCH_SIZE) {
		const batchEndIndex = Math.min(i + BATCH_SIZE - 1, endIndex);
		const currentBatch = Math.floor((i - startIndex) / BATCH_SIZE) + 1;

		logger.process(
			`BATCH ${currentBatch}/${totalBatches}: Getting tasks ${i} to ${batchEndIndex + 1}`
		);

		const batchResult = (await publicClientHTTP.readContract({
			address: agiContractAddress as Hex,
			abi: agiContractABI,
			functionName: 'getProcessedAGIs',
			args: [startIndex, endIndex],
		})) as number[];

		logger.item(`Retrieved ${batchResult.length} processed tasks in batch ${currentBatch}`);
		result.push(...batchResult);
	}

	logger.success(`BATCH PROCESSING COMPLETE: Retrieved ${result.length} processed tasks in total`);
	return result;
};

// get the pending AGIs
// here pending means the any AGIs that are not finialzed yet, including those in intermediate states
const getPendingAGIs = async (processedAGIsAmount: number, startId: number, endId: number) => {
	// Convert task IDs to indices (0-based), ensuring we never go below 0
	const startIndex = Math.max(0, startId - 1);
	const endIndex = Math.min(endId - 1, processedAGIsAmount - 1);

	// Get processed tasks from startIndex to endIndex
	const processedIds = await getProcessedAGIIds(startIndex, endIndex);

	// Convert bigint to number for comparison
	const processedSet = new Set(processedIds.map(id => Number(id)));

	// Create array from startTaskId to endTaskId (inclusive)
	const allTaskIds = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);

	return allTaskIds.filter(taskId => !processedSet.has(taskId));
};

const processPendingAGIs = async (startId = 1) => {
	try {
		logger.separator();
		logger.info(`[processPendingAGIs] TASK CHECK: Starting from task ID 1`);
		if (startId < 1) {
			startId = 1;
		}

		const nextOrderId = (await publicClientHTTP.readContract({
			address: agiContractAddress as Hex,
			abi: agiContractABI,
			functionName: 'nextOrderId',
			args: [],
		})) as bigint;

		if (nextOrderId === 1n) {
			logger.info('No tasks to process');
			return;
		}

		const totalTasksAmount = nextOrderId - 1n;

		const processedAGIsAmount = (await publicClientHTTP.readContract({
			address: agiContractAddress as Hex,
			abi: agiContractABI,
			functionName: 'processedAGIsLength',
			args: [],
		})) as bigint;

		if (totalTasksAmount === processedAGIsAmount) {
			logger.info('TASK STATUS');
			logger.item('All tasks have been processed');
			return;
		}

		// Log summary
		logger.info('TASK SUMMARY');
		logger.item(`Total tasks in system: ${totalTasksAmount.toString()}`);
		logger.item(`Total processed agis: ${processedAGIsAmount.toString()}`);

		const pendingAGIsAmount = totalTasksAmount - processedAGIsAmount;
		logger.warning(`${pendingAGIsAmount.toString()} unprocessed agis found in the system`);

		logger.separator();
		logger.warning('BATCH TASK PROCESSING');
		logger.item(`${pendingAGIsAmount.toString()} unprocessed agi found`);
		logger.item(`Processing range: ${startId} to ${totalTasksAmount.toString()} +1 `);

		const unprocessedAGIs = await getPendingAGIs(
			Number(processedAGIsAmount),
			startId,
			Number(totalTasksAmount)
		);

		if (unprocessedAGIs.length === 0) {
			logger.success(`No unprocessed tasks found in range 1-${totalTasksAmount.toString()}`);
			return;
		}

		// Process pending  agis
		logger.warning(
			`Found ${unprocessedAGIs.length} unprocessed tasks: ${unprocessedAGIs.join(', ')}`
		);
		unprocessedAGIs.sort((a, b) => a - b); // Process in order

		for (const agiId of unprocessedAGIs) {
			logger.info(`adding task #${agiId} to the queue`);
			await agiQueueManager.add(agiId);
		}

		logger.success(`All ${unprocessedAGIs.length} tasks added to the queue`);
	} catch (error) {
		console.error('Error processing pending AGIs', error);
		// Don't throw, just log the error
	}
};

// start the listener to listen to agi published events
export default async function startListener() {
	try {
		logger.item('Listening for events at address:');
		logger.item(`${agiContractAddress}`);

		const unwatch = publicClientWSS.watchContractEvent({
			address: agiContractAddress as Hex,
			eventName: 'AGIPublished',
			abi: agiContractABI,
			onLogs: logs => {
				// Process events sequentially
				logs.forEach(async log => {
					try {
						// @ts-ignore
						const { orderId, assetToSell, amountToSell, assetToBuy, orderStatus } = log.args;

						logger.separator();
						logger.event(`NEW EVENT FOR TASK #${orderId}`);
						logger.item(`Asset to Sell: ${assetToSell}`);
						logger.item(`Amount to Sell: ${amountToSell}`);
						logger.item(`Asset to Buy: ${assetToBuy}`);
						logger.item(`Order Status: ${orderStatus}`);

						await agiQueueManager.add(orderId);
					} catch (error) {
						logger.error('ERROR PROCESSING EVENT');
						logger.item('Error processing YeetCreated event:');
						logger.item(`${error}`);
						// Continue with next event instead of stopping
					}
				});
			},
		});

		await processPendingAGIs();
	} catch (error) {
		console.error('Error starting listener', error);
	}
}
