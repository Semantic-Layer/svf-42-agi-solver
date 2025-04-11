/**
 * Configuration file for the SVF AGI Solver
 * 
 * This file centralizes all hardcoded values from the codebase to make them easier to manage and update.
 */

// AGI Queue Manager Configuration
export const AGI_QUEUE_CONFIG = {
    // Retry and delay settings
    RETRY_DELAY: 1000, // 1 second delay between retries
    SWAP_RETRY_DELAY: 30000, // 30 seconds delay for swap retries
    MAX_RETRIES: 2, // Maximum number of retries
    CHECK_INTERVAL: 2000, // Check queue every 2 seconds

    // Order status constants
    ORDER_STATUS: {
        PendingDispense: 0, // Contract: Initial state, waiting to withdraw asset
        DispensedPendingProceeds: 1, // Contract: Asset withdrawn, ready for swap
        SwapInitiated: 3, // Internal: Swap operation started
        SwapCompleted: 4, // Internal: Swap done, ready to deposit proceeds
        ProceedsReceived: 2, // Contract: Final state, all operations completed
    }
};

// Solver Configuration
export const SOLVER_CONFIG = {
    BATCH_SIZE: 50, // Number of AGIs to process in a batch
    PROCESS_INTERVAL: 30000, // 30 seconds interval for processing pending AGIs
};

// Swap Configuration
export const SWAP_CONFIG = {
    // LiFi SDK configuration
    LIFI: {
        INTEGRATOR: 'svf42',
        DEFAULT_OPTIONS: {
            slippage: 0.05, // 5% slippage tolerance
            order: 'RECOMMENDED' as const, // Type assertion to ensure it matches the expected type
        }
    }
};

// Logger Configuration
export const LOGGER_CONFIG = {
    // File paths
    LOG_FILES: {
        SUCCESS: 'logs/success.log',
    },

    // Log levels
    LEVELS: {
        INFO: 'info',
    }
};

// Blockchain Configuration
export const BLOCKCHAIN_CONFIG = {
    // WebSocket configuration
    WS: {
        KEEP_ALIVE: true,
        RECONNECT: true,
    }
};

// Export a default configuration object that combines all configs
export default {
    AGI_QUEUE: AGI_QUEUE_CONFIG,
    SOLVER: SOLVER_CONFIG,
    SWAP: SWAP_CONFIG,
    LOGGER: LOGGER_CONFIG,
    BLOCKCHAIN: BLOCKCHAIN_CONFIG,
}; 