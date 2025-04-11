import { logger } from './logger.ts';

/**
 * Simple metrics collection system
 * Tracks various statistics about the AGI processing system
 */
export class MetricsCollector {
    private metrics: {
        processedAGIs: number;
        failedSwaps: number;
        totalGasUsed: bigint;
        averageProcessingTime: number;
        processingTimes: number[];
        lastResetTime: number;
    };

    constructor() {
        this.metrics = {
            processedAGIs: 0,
            failedSwaps: 0,
            totalGasUsed: BigInt(0),
            averageProcessingTime: 0,
            processingTimes: [],
            lastResetTime: Date.now(),
        };
    }

    /**
     * Record a successfully processed AGI
     * @param processingTime - Time taken to process in milliseconds
     * @param gasUsed - Gas used for the transaction
     */
    recordProcessedAGI(processingTime: number, gasUsed: bigint): void {
        this.metrics.processedAGIs++;
        this.metrics.totalGasUsed += gasUsed;
        this.metrics.processingTimes.push(processingTime);

        // Update average processing time
        const sum = this.metrics.processingTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageProcessingTime = sum / this.metrics.processingTimes.length;

        logger.info(`Metrics: Processed AGI #${this.metrics.processedAGIs} in ${processingTime}ms, gas used: ${gasUsed}`);
    }

    /**
     * Record a failed swap
     */
    recordFailedSwap(): void {
        this.metrics.failedSwaps++;
        logger.warning(`Metrics: Failed swap recorded. Total failures: ${this.metrics.failedSwaps}`);
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Reset all metrics
     */
    resetMetrics(): void {
        this.metrics = {
            processedAGIs: 0,
            failedSwaps: 0,
            totalGasUsed: BigInt(0),
            averageProcessingTime: 0,
            processingTimes: [],
            lastResetTime: Date.now(),
        };
        logger.info('Metrics reset');
    }

    /**
     * Log a summary of current metrics
     */
    logMetricsSummary(): void {
        const uptime = (Date.now() - this.metrics.lastResetTime) / 1000 / 60; // in minutes

        logger.separator();
        logger.info('METRICS SUMMARY');
        logger.item(`Uptime: ${uptime.toFixed(2)} minutes`);
        logger.item(`Processed AGIs: ${this.metrics.processedAGIs}`);
        logger.item(`Failed Swaps: ${this.metrics.failedSwaps}`);
        logger.item(`Success Rate: ${this.metrics.processedAGIs > 0
            ? ((this.metrics.processedAGIs - this.metrics.failedSwaps) / this.metrics.processedAGIs * 100).toFixed(2)
            : '0'}%`);
        logger.item(`Average Processing Time: ${this.metrics.averageProcessingTime.toFixed(2)}ms`);
        logger.item(`Total Gas Used: ${this.metrics.totalGasUsed.toString()}`);
        logger.separator();
    }
}

// Create a singleton instance
export const metricsCollector = new MetricsCollector(); 