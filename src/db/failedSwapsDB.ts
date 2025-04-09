import Database from 'better-sqlite3';
import path from 'path';

class FailedSwapsDB {
	private db!: Database.Database;
	private initialized: boolean = false;

	async init() {
		if (this.initialized) return;

		// make sure logs directory exists
		const dbPath = path.join(process.cwd(), 'logs', 'failed_swaps.db');

		this.db = new Database(dbPath);

		// create table (if not exists)
		// we use TEXT for amount_to_sell in case the amount is too large
		this.db.exec(`
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

	/**
	 * Records a failed swap in the database.
	 * - Each failed AGI will only be recorded once.
	 * - Any type of exchange failure will be recorded.
	 */
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
			const stmt = this.db.prepare(
				'INSERT OR IGNORE INTO failed_swaps (timestamp, agi_id, error_message, intent_type, asset_to_sell, amount_to_sell, asset_to_buy, order_id, order_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
			);
			stmt.run(
				Math.floor(Date.now() / 1000),
				agiId,
				errorMessage,
				intentType,
				assetToSell,
				amountToSell.toString(),
				assetToBuy,
				Number(orderId),
				orderStatus
			);
		} catch (error) {
			console.error('Error recording failed swap in database:', error);
		}
	}

	/**
	 * Attempts to delete a failed swap record from the database.
	 * - Ensure that only failed swap records are stored in the database.
	 * - After each final swap, check if there are corresponding failed records.
	 *   If there are, delete the records.
	 * - After each swap is completed (handleSwapCompleted), a check is performed to see if the processed AGI
	 *   has a history of failure records in the database. This will increase the runtime, but since the amount
	 *   of failed data in the production environment is extremely low, the query time will be in milliseconds.
	 *   Therefore, this is acceptable.
	 */
	async tryDeleteFailedSwap(agiId: number) {
		await this.init();

		try {
			// First, check if the record exists.
			const stmt = this.db.prepare('SELECT * FROM failed_swaps WHERE agi_id = ?');
			const existingRecord = stmt.get(agiId);
			if (!existingRecord) {
				return;
			}

			// Execute the delete operation.
			const deleteStmt = this.db.prepare('DELETE FROM failed_swaps WHERE agi_id = ?');
			deleteStmt.run(agiId);
			console.log(`Deleted failed swap record for AGI ID ${agiId}`);
		} catch (error) {
			console.error(`Error deleting record for AGI ID ${agiId}:`, error);
		}
	}
}

export const failedSwapsDB = new FailedSwapsDB();
