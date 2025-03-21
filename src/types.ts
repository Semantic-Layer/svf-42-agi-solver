// Types and interfaces shared across the state machine

export interface Asset {
	address: `0x${string}`;
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
	assetToSell: `0x${string}`; // address of asset to sell
	amountToSell: number; // amount of asset to sell
	assetToBuy: `0x${string}`; // address of asset to buy
	orderIndex: number; // index in array
	orderStatus: number; // 0: pending dispense, 1: dispensed pending deposit, 2: completed
}

export interface IMock13 {
	withdrawSVF(amount: number, orderIndex: number): Promise<void>;
	withdrawAsset(amount: number, orderIndex: number): Promise<void>;
	depositSVF(amount: number, orderIndex: number): Promise<void>;
	depositAsset(amount: number, orderIndex: number): Promise<void>;
	isTokenWhitelisted(token: `0x${string}`): Promise<boolean>;
	publishAGI(
		intentType: number,
		assetToSell: `0x${string}`,
		amountToSell: number,
		assetToBuy: `0x${string}`
	): Promise<void>;
	viewAGI(orderIndex: number): Promise<AgentGeneratedIntent>;
	getCurrentSolver(): Promise<`0x${string}`>;
	// Event handling methods
	on(eventName: string, listener: (...args: any[]) => void): void;
	filters: {
		AGIPublished(): any;
	};
	queryFilter(filter: any, fromBlock: number, toBlock: number): Promise<Array<any>>;
}

// LiFi integration types
export interface LiFiQuote {
	fromToken: `0x${string}`;
	toToken: `0x${string}`;
	fromAmount: bigint;
	toAmount: bigint;
	route: any;
}

export interface LiFiTrade {
	quote: LiFiQuote;
	status: 'PENDING' | 'COMPLETED' | 'FAILED';
	txHash?: string;
	error?: string;
}

export enum State {
	IDLE = 'IDLE',
	BUY_ASSET = 'BUY_ASSET',
	SELL_ASSET = 'SELL_ASSET',
	LOG_ERROR = 'LOG_ERROR',
	HANDLE_FATAL_ERROR = 'HANDLE_FATAL_ERROR',
}
