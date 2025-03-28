/**
 * Simulates a swap operation with a delay to simulate transaction latency
 * @param assetToSell - The asset to sell
 * @param amountToSell - The amount to sell
 * @param assetToBuy - The asset to buy
 * @returns The amount of tokens to buy after the swap
 */
export async function mockSwap(
	assetToSell: string,
	amountToSell: number,
	assetToBuy: string
): Promise<number> {
	// Simulate transaction latency (2 seconds)
	await new Promise(resolve => setTimeout(resolve, 2000));

	// Simulate a simple 1:1 swap
	return amountToSell;
}
