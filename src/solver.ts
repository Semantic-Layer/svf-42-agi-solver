import logger from './logger.ts';
import {
	agiContractABI,
	agiContractAddress,
	publicClientHTTP,
	publicClientWSS,
} from './clients.ts';
import { Hex } from 'viem';
import { AGIQueueManager } from './AGIQueueManager.ts';

// Create a single instance
const agiQueueManager = new AGIQueueManager();

// call the contract function getProcessedAGIs
const getProcessedAGIIds = async (startIndex: number, endIndex: number) => {
	const processedAGIs = (await publicClientHTTP.readContract({
		address: agiContractAddress as Hex,
		abi: agiContractABI,
		functionName: 'getProcessedAGIs',
		args: [startIndex, endIndex],
	})) as number[];
	return processedAGIs;
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

		const pendingAGIsAmount = totalTasksAmount - processedAGIsAmount;

		logger.separator();
		logger.warning('BATCH TASK PROCESSING');
		logger.item(`${pendingAGIsAmount.toString()} unprocessed agi found`);
		logger.item(`Processing range: ${startId} to ${totalTasksAmount.toString()} +1 `);

		const unprocessedAGIs = await getPendingAGIs(
			Number(processedAGIsAmount),
			startId,
			Number(totalTasksAmount)
		);

		logger.item(`Pending AGI IDs: ${unprocessedAGIs}`);

		for (const agiId of unprocessedAGIs) {
			await agiQueueManager.add(agiId);
		}
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

		// await processPendingAGIs();
	} catch (error) {
		console.error('Error starting listener', error);
	}
}
