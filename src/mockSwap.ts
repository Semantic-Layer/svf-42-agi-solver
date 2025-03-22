// TODO: implement actual swap here
// here we just simply a random number as the amount for asset to buy
export async function mockSwap(assetToSell: string, amountToSell: number, assetToBuy: string) {
	return Math.floor(Math.random() * 1000000) + 1; // from 1 to 1000000
}
