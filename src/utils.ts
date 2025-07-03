import { type Hex } from 'viem';
import {
	agiContractAddress,
	walletClient,
	publicClientHTTP,
	agiContractABI,
	IERC20ABI,
} from './clients.ts';
import logger from './logger.ts';

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
		const receipt = await publicClientHTTP.waitForTransactionReceipt({ hash });
		if (receipt.status === 'reverted') {
			throw new Error('Withdraw transaction failed');
		}
		logger.item(`🎉 [Order ${orderIndex}]: withdraw txn hash: ${hash}`);
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
export async function depositAsset(orderIndex: number, assetToBuy: string, amount: number) {
	try {
		// We should approve the assetToBuy to the warehouse13 contract first! Or the txn will fail
		await approveERC20(assetToBuy, agiContractAddress as Hex, amount.toString());

		// Start to process the deposit
		logger.process(`Depositing ${amount} for AGI ${orderIndex}`);
		const { request } = await publicClientHTTP.simulateContract({
			account: walletClient.account,
			address: agiContractAddress as Hex,
			abi: agiContractABI,
			functionName: 'depositAsset',
			args: [orderIndex, amount],
		});

		const hash = await walletClient.writeContract(request);
		const receipt = await publicClientHTTP.waitForTransactionReceipt({ hash });
		if (receipt.status === 'reverted') {
			throw new Error('Deposit transaction failed');
		}
		logger.item(`🎉 [Order ${orderIndex}]: deposit txn hash: ${hash}`);
	} catch (error) {
		logger.subItem(`Error depositing asset for AGI ${orderIndex}: ${error}`);
		throw error;
	}
}

/**
 * Approve the assetToBuy to the warehouse13 contract
 * @param tokenAddress - The address of the token to approve
 * @param spenderAddress - The address of the spender
 * @param amount - The amount of tokens to approve
 */
export async function approveERC20(tokenAddress: string, spenderAddress: string, amount: string) {
	logger.info(`Approving ${amount} tokens for spender ${spenderAddress}`);

	const { request } = await publicClientHTTP.simulateContract({
		address: tokenAddress as Hex,
		abi: IERC20ABI,
		functionName: 'approve',
		args: [spenderAddress as Hex, BigInt(amount)],
		account: walletClient.account!,
	});

	const hash = await walletClient.writeContract(request);

	// Wait for the transaction to be mined
	const receipt = await publicClientHTTP.waitForTransactionReceipt({ hash });
	if (receipt.status === 'reverted') {
		throw new Error('Approval transaction failed');
	}

	logger.success(`🎉 Token approval successful! txn hash: ${hash}`);
}
