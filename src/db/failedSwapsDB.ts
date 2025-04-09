import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

class FailedSwapsDB {
	private db: any;
	private initialized: boolean = false;

	async init() {
		if (this.initialized) return;

		// make sure logs directory exists
		const dbPath = path.join(process.cwd(), 'logs', 'failed_swaps.db');

		this.db = await open({
			filename: dbPath,
			driver: sqlite3.Database,
		});

		// create table (if not exists)
		// we use TEXT for amount_to_sell in case the amount is too large
		await this.db.exec(`
            CREATE TABLE IF NOT EXISTS failed_swaps (
                timestamp INTEGER NOT NULL,
                agi_id INTEGER PRIMARY KEY,
                error_message TEXT NOT NULL,
                intent_type INTEGER NOT NULL,
                asset_to_sell TEXT NOT NULL,
                amount_to_sell TEXT NOT NULL,
                asset_to_buy TEXT NOT NULL,
                order_id INTEGER NOT NULL,
                order_status INTEGER NOT NULL
            )
        `);

		this.initialized = true;
	}

	async recordFailedSwap(
		agiId: number,
		errorMessage: string,
		intentType: number,
		assetToSell: string,
		amountToSell: bigint,
		assetToBuy: string,
		orderId: number,
		orderStatus: number
	) {
		await this.init();

		try {
			await this.db.run(
				'INSERT OR IGNORE INTO failed_swaps (timestamp, agi_id, error_message, intent_type, asset_to_sell, amount_to_sell, asset_to_buy, order_id, order_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
				[
					Math.floor(Date.now() / 1000),
					agiId,
					errorMessage,
					intentType,
					assetToSell,
					amountToSell.toString(),
					assetToBuy,
					Number(orderId),
					orderStatus,
				]
			);
		} catch (error) {
			console.error('Error recording failed swap in database:', error);
			if (error instanceof Error) {
				console.error('Error details:', {
					name: error.name,
					message: error.message,
					stack: error.stack,
				});
			}
		}
	}

	async tryDeleteFailedSwap(agiId: number) {
		await this.init();

		try {
			// First, check if the record exists.
			const existingRecord = await this.db.get('SELECT * FROM failed_swaps WHERE agi_id = ?', [
				agiId,
			]);
			if (!existingRecord) {
				return;
			}

			// Execute the delete operation.
			await this.db.run('DELETE FROM failed_swaps WHERE agi_id = ?', [agiId]);
			console.log(`Deleted record for AGI ID ${agiId}`);
		} catch (error) {
			console.error(`Error deleting record for AGI ID ${agiId}:`, error);
		}
	}
}

export const failedSwapsDB = new FailedSwapsDB();
