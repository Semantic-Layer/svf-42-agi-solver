// Mock implementation of the contract interface
class MockContract {
	private agentGeneratedIntents: Array<{
		intentType: number;
		assetToSell: string;
		amountToSell: number;
		assetToBuy: string;
		orderIndex: number;
		orderStatus: number;
	}> = [];

	async withdrawSVF(amount: number, orderIndex: number): Promise<void> {
		console.log(`Withdrawing ${amount} SVF tokens for order ${orderIndex}`);
	}

	async withdrawAsset(amount: number, orderIndex: number): Promise<void> {
		console.log(`Withdrawing ${amount} tokens for order ${orderIndex}`);
	}

	async depositSVF(amount: number, orderIndex: number): Promise<void> {
		console.log(`Depositing ${amount} SVF tokens for order ${orderIndex}`);
	}

	async depositAsset(amount: number, orderIndex: number): Promise<void> {
		console.log(`Depositing ${amount} tokens for order ${orderIndex}`);
	}

	async isTokenWhitelisted(token: string): Promise<boolean> {
		return token === 'WHITELISTED_TOKEN_ADDRESS';
	}

	async publishAGI(
		intentType: number,
		assetToSell: string,
		amountToSell: number,
		assetToBuy: string
	): Promise<void> {
		const orderIndex = this.agentGeneratedIntents.length;
		this.agentGeneratedIntents.push({
			intentType,
			assetToSell,
			amountToSell,
			assetToBuy,
			orderIndex,
			orderStatus: 0
		});
		this.emit('AGIPublished', orderIndex);
	}

	async viewAGI(orderIndex: number): Promise<any> {
		if (orderIndex >= this.agentGeneratedIntents.length) {
			throw new Error('Invalid order index');
		}
		return this.agentGeneratedIntents[orderIndex];
	}

	async getCurrentSolver(): Promise<string> {
		return '0x6C00Cbc79FED15c26716bDE40d29F4058Be63fDA';
	}

	// Event handling methods
	private listeners: { [key: string]: Array<(...args: any[]) => void> } = {};

	on(eventName: string, listener: (...args: any[]) => void): void {
		if (!this.listeners[eventName]) {
			this.listeners[eventName] = [];
		}
		this.listeners[eventName].push(listener);
	}

	private emit(eventName: string, ...args: any[]): void {
		const eventListeners = this.listeners[eventName];
		if (eventListeners) {
			eventListeners.forEach(listener => listener(...args));
		}
	}

	filters = {
		AGIPublished: () => ({})
	};

	async queryFilter(filter: any, fromBlock: number, toBlock: number): Promise<Array<any>> {
		return [];
	}
}

async function main() {
	// Import types and AGISolver here to avoid circular dependencies
	const { AGISolver } = await import('./AGISolver');
	const { State } = await import('./types');
	const { ethers } = await import('ethers');

	// Initialize the contract and solver
	const contract = new MockContract();
	const provider = new ethers.JsonRpcProvider('http://localhost:8545'); // Using local provider for testing
	const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Private key for testing
	const solver = new AGISolver(contract, provider, privateKey);

	// Example buy order
	const buyOrder = {
		orderId: 1,
		assetToSell: { address: 'SVF_TOKEN_ADDRESS', balance: 1000 },
		assetToBuy: { address: 'WHITELISTED_TOKEN_ADDRESS', balance: 0 },
		amount: 100,
		intentType: 0,
		orderStatus: 0,
	};

	console.log('Initial state:', solver.getState());

	try {
		// Try to execute buy order
		console.log('\nAttempting to process buy order...');
		const buySuccess = await solver.transitionToBuyAsset(buyOrder);
		console.log(`Buy order success: ${buySuccess}`);
		console.log('Current state:', solver.getState());

		// Update order status and complete the buy
		if (buySuccess) {
			buyOrder.orderStatus = 1; // Set to dispensed pending deposit
			console.log('\nAttempting to complete buy order...');
			// Use the current state's handleOrder method to process the deposit
			await solver.handleOrder(buyOrder);
			console.log('Final state:', solver.getState());
		}
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error('Error during execution:', error.message);
		} else {
			console.error('An unknown error occurred');
		}
	}
}

// Run the example
main().catch((error: unknown) => {
	if (error instanceof Error) {
		console.error('Fatal error:', error.message);
	} else {
		console.error('An unknown error occurred');
	}
});
