import { Order, State } from '../types';
import { BaseState } from './BaseState';

export class LogErrorState extends BaseState {
	async enter(): Promise<void> {
		console.log('Entering LOG_ERROR state');
	}

	async exit(): Promise<void> {
		console.log('Exiting LOG_ERROR state');
	}

	async handleOrder(order: Order): Promise<boolean> {
		// In LOG_ERROR state, we can only return to IDLE
		return this.context.returnToIdle();
	}

	getName(): State {
		return State.LOG_ERROR;
	}
}
