// Types and interfaces shared across the state machine

export interface Asset {
	address: string;
	balance: number;
}

export interface Order {
	orderId: number;
	assetToSell: Asset;
	assetToBuy: Asset;
	amount: number;
	intentType: number; // 0 for trade
	orderStatus: number; // 0: pending, 1: dispensed pending deposit, 2: completed
}

export interface AgentGeneratedIntent {
	intentType: number; // 0 for trade, 1 for others
	assetToSell: string; // address of asset to sell
	amountToSell: number; // amount of asset to sell
	assetToBuy: string; // address of asset to buy
	orderId: number; // index in array
	orderStatus: number; // 0: pending dispense, 1: dispensed pending deposit, 2: completed
}
