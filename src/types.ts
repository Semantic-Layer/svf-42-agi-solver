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

export interface IMock13 {
	withdrawSVF(amount: number, orderIndex: number): Promise<void>;
	withdrawAsset(amount: number, orderIndex: number): Promise<void>;
	depositSVF(amount: number, orderIndex: number): Promise<void>;
	depositAsset(amount: number, orderIndex: number): Promise<void>;
	isTokenWhitelisted(token: string): Promise<boolean>;
}

export enum State {
	IDLE = 'IDLE',
	BUY_ASSET = 'BUY_ASSET',
	SELL_ASSET = 'SELL_ASSET',
	LOG_ERROR = 'LOG_ERROR',
	HANDLE_FATAL_ERROR = 'HANDLE_FATAL_ERROR',
}
