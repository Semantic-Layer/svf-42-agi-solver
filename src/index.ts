// Mock implementation of the contract interface
class MockContract {
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
        return token === "WHITELISTED_TOKEN_ADDRESS";
    }
}

async function main() {
    // Import types and AGISolver here to avoid circular dependencies
    const { AGISolver } = await import('./AGISolver');
    const { State } = await import('./types');

    // Initialize the contract and solver
    const contract = new MockContract();
    const solver = new AGISolver(contract);

    // Example buy order
    const buyOrder = {
        orderId: 1,
        assetToSell: { address: "SVF_TOKEN_ADDRESS", balance: 1000 },
        assetToBuy: { address: "WHITELISTED_TOKEN_ADDRESS", balance: 0 },
        amount: 100,
        intentType: 0,
        orderStatus: 0
    };

    console.log("Initial state:", solver.getState());

    try {
        // Try to execute buy order
        console.log("\nAttempting to process buy order...");
        const buySuccess = await solver.transitionToBuyAsset(buyOrder);
        console.log(`Buy order success: ${buySuccess}`);
        console.log("Current state:", solver.getState());

        // Update order status and complete the buy
        if (buySuccess) {
            buyOrder.orderStatus = 1; // Set to dispensed pending deposit
            console.log("\nAttempting to complete buy order...");
            // Use the current state's handleOrder method to process the deposit
            await solver.handleOrder(buyOrder);
            console.log("Final state:", solver.getState());
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error during execution:", error.message);
        } else {
            console.error("An unknown error occurred");
        }
    }
}

// Run the example
main().catch((error: unknown) => {
    if (error instanceof Error) {
        console.error("Fatal error:", error.message);
    } else {
        console.error("An unknown error occurred");
    }
});