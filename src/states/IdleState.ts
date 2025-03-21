import { Order, State } from '../types';
import { BaseState } from './BaseState';

export class IdleState extends BaseState {
	async enter(): Promise<void> {
		console.log('Entering IDLE state');
	}

	async exit(): Promise<void> {
		console.log('Exiting IDLE state');
	}

	async handleOrder(order: Order): Promise<boolean> {
		// In IDLE state, we can transition to either BUY_ASSET or SELL_ASSET
		if (order.assetToSell.address === this.context.SVF_TOKEN) {
			return this.context.transitionToBuyAsset(order);
		} else if (order.assetToBuy.address === this.context.SVF_TOKEN) {
			return this.context.transitionToSellAsset(order);
		}
		return false;
	}

	getName(): State {
		return State.IDLE;
	}
}
