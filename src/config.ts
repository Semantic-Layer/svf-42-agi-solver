import 'dotenv/config';

/**
 * Configuration system for the AGI Queue Manager
 * Loads values from environment variables with fallbacks to defaults
 */
export interface Config {
    // Queue settings
    retryDelay: number;
    swapRetryDelay: number;
    maxRetries: number;
    checkInterval: number;

    // Swap settings
    defaultSlippage: number;

    // Gas settings
    maxGasPrice: bigint;
    gasLimitMultiplier: number;

    // Logging settings
    logLevel: 'debug' | 'info' | 'warn' | 'error';

    // Metrics settings
    metricsLogInterval: number;
}

/**
 * Default configuration values
 */
const defaultConfig: Config = {
    // Queue settings
    retryDelay: 1000, // 1 second
    swapRetryDelay: 30000, // 30 seconds
    maxRetries: 2,
    checkInterval: 2000, // 2 seconds

    // Swap settings
    defaultSlippage: 0.05, // 5%

    // Gas settings
    maxGasPrice: BigInt(100000000000), // 100 gwei
    gasLimitMultiplier: 1.2, // 20% buffer

    // Logging settings
    logLevel: 'info',

    // Metrics settings
    metricsLogInterval: 300000, // 5 minutes
};

/**
 * Load configuration from environment variables
 * Falls back to default values if not specified
 */
export function loadConfig(): Config {
    return {
        // Queue settings
        retryDelay: parseInt(process.env.RETRY_DELAY || defaultConfig.retryDelay.toString()),
        swapRetryDelay: parseInt(process.env.SWAP_RETRY_DELAY || defaultConfig.swapRetryDelay.toString()),
        maxRetries: parseInt(process.env.MAX_RETRIES || defaultConfig.maxRetries.toString()),
        checkInterval: parseInt(process.env.CHECK_INTERVAL || defaultConfig.checkInterval.toString()),

        // Swap settings
        defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || defaultConfig.defaultSlippage.toString()),

        // Gas settings
        maxGasPrice: BigInt(process.env.MAX_GAS_PRICE || defaultConfig.maxGasPrice.toString()),
        gasLimitMultiplier: parseFloat(process.env.GAS_LIMIT_MULTIPLIER || defaultConfig.gasLimitMultiplier.toString()),

        // Logging settings
        logLevel: (process.env.LOG_LEVEL || defaultConfig.logLevel) as 'debug' | 'info' | 'warn' | 'error',

        // Metrics settings
        metricsLogInterval: parseInt(process.env.METRICS_LOG_INTERVAL || defaultConfig.metricsLogInterval.toString()),
    };
}

// Export the loaded configuration
export const config = loadConfig(); 