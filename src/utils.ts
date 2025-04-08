import { type Hex } from 'viem';
import { publicClientHTTP } from './clients.ts';
import logger from './logger.ts';

export async function checkTransactionReceipt(hash: Hex, context = 'no txn context provided') {
	try {
		// Wait for 1 seconds before checking the receipt
		await new Promise(resolve => setTimeout(resolve, 1000));
		const receipt = await publicClientHTTP.getTransactionReceipt({
			hash: hash,
		});

		if (receipt.status === 'reverted') {
			logger.error(`${context}: ⛔️  Transaction reverted`);
			throw new Error('Transaction reverted');
		}
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		while (true) {
			try {
				await new Promise(resolve => setTimeout(resolve, 500));
				const receipt = await publicClientHTTP.getTransactionReceipt({
					hash: hash,
				});

				if (receipt.status === 'reverted') {
					logger.error(`${context}: ⛔️  Transaction reverted`);
					throw new Error('Transaction reverted');
				}
				logger.success(`${context}: ✅  Transaction successful`);
				// If the receipt is successfully obtained, exit the loop.
				break;
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			} catch (retryError) {
				logger.warning(
					`${context}: ⚠️  Error getting transaction receipt, trying again in 0.5 second`
				);
			}
		}
	}
}
