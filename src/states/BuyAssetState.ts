import { Order, State } from '../types';
import { BaseState } from './BaseState';

export class BuyAssetState extends BaseState {
	private retryCount: number = 0;
	private readonly MAX_RETRIES: number = 20;
	private readonly RETRY_DELAY: number = 50000; // 50 seconds

	async enter(): Promise<void> {
		console.log('Entering BUY_ASSET state');
		this.retryCount = 0;
	}

	async exit(): Promise<void> {
		console.log('Exiting BUY_ASSET state');
	}

	async handleOrder(order: Order): Promise<boolean> {
		try {
			if (order.orderStatus !== 1) {
				throw new Error('Order must be in dispensed pending deposit status');
			}

			if (!(await this.context.isTokenWhitelisted(order.assetToBuy.address))) {
				throw new Error('Token not whitelisted');
			}

			await this.context.depositAsset(order.amount, order.orderId);
			return this.context.returnToIdle();
		} catch (error) {
			if (this.retryCount >= this.MAX_RETRIES) {
				await this.context.transitionToState(State.HANDLE_FATAL_ERROR);
				return false;
			}

			this.retryCount++;
			await this.context.transitionToState(State.LOG_ERROR);
			await this.delay(this.RETRY_DELAY);
			return false;
		}
	}

	getName(): State {
		return State.BUY_ASSET;
	}
}
