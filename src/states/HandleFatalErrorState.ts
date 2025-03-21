import { Order, State } from '../types';
import { BaseState } from './BaseState';

export class HandleFatalErrorState extends BaseState {
	async enter(): Promise<void> {
		console.log('Entering HANDLE_FATAL_ERROR state');
		console.error('System has entered fatal error mode - manual intervention required');
	}

	async exit(): Promise<void> {
		console.log('Exiting HANDLE_FATAL_ERROR state');
	}

	async handleOrder(order: Order): Promise<boolean> {
		// In HANDLE_FATAL_ERROR state, we can only manually relaunch
		return false;
	}

	async manualRelaunch(): Promise<boolean> {
		return this.context.returnToIdle();
	}

	getName(): State {
		return State.HANDLE_FATAL_ERROR;
	}
}
