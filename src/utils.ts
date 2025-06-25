import { type Hex } from 'viem';
import { agiContractAddress, walletClient, publicClientHTTP, agiContractABI } from './clients.ts';
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

/**
 * Withdraws the asset to sell from the contract
 * @param orderIndex - The ID of the AGI to withdraw for
 */
export async function withdrawAsset(orderIndex: number) {
	try {
		logger.process(`Withdrawing asset for AGI ${orderIndex}`);
		const { request } = await publicClientHTTP.simulateContract({
			account: walletClient.account,
			address: agiContractAddress as Hex,
			abi: agiContractABI,
			functionName: 'withdrawAsset',
			args: [orderIndex],
		});

		const hash = await walletClient.writeContract(request);
		logger.item(`[Order ${orderIndex}]: withdraw txn hash: ${hash}`);
		await checkTransactionReceipt(hash, `[withdraw txn hash for AGI ${orderIndex}]`);
	} catch (error) {
		logger.subItem(`Error withdrawing asset for AGI ${orderIndex}: ${error}`);
		throw error;
	}
}

/**
 * Deposits the swapped assets back to the contract
 * @param orderIndex - The ID of the AGI to deposit for
 * @param amount - The amount of tokens to deposit
 */
export async function depositAsset(orderIndex: number, amount: number) {
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
		const hash = await walletClient.writeContract(request);
		logger.item(`[Order ${orderIndex}]: deposit txn hash: ${hash}`);
		await checkTransactionReceipt(hash, `[deposit txn hash for AGI ${orderIndex}]`);
	} catch (error) {
		logger.subItem(`Error depositing asset for AGI ${orderIndex}: ${error}`);
		throw error;
	}
}
