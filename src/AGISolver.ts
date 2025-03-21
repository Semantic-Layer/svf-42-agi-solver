import { Order, State, IMock13, Asset } from './types';
import { IState } from './states/BaseState';
import { IdleState } from './states/IdleState';
import { BuyAssetState } from './states/BuyAssetState';
import { SellAssetState } from './states/SellAssetState';
import { LogErrorState } from './states/LogErrorState';
import { HandleFatalErrorState } from './states/HandleFatalErrorState';

export class AGISolver {
	public readonly SVF_TOKEN: string = 'SVF_TOKEN_ADDRESS'; // Replace with actual address
	private readonly COOLDOWN_PERIOD: number = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

	private currentState: IState;
	private lastOrderIndex: number;
	private lastActionTimestamp: number;
	private lastSellTimestamp: Map<string, number>;
	private contract: IMock13;
	private states: Map<State, IState>;

	constructor(contractInstance: IMock13) {
		this.contract = contractInstance;
		this.lastOrderIndex = 0;
		this.lastActionTimestamp = Date.now();
		this.lastSellTimestamp = new Map();

		// Initialize all states
		this.states = new Map();
		this.states.set(State.IDLE, new IdleState(this));
		this.states.set(State.BUY_ASSET, new BuyAssetState(this));
		this.states.set(State.SELL_ASSET, new SellAssetState(this));
		this.states.set(State.LOG_ERROR, new LogErrorState(this));
		this.states.set(State.HANDLE_FATAL_ERROR, new HandleFatalErrorState(this));

		// Set initial state
		this.currentState = this.states.get(State.IDLE)!;
		this.currentState.enter();
	}

	public async handleOrder(order: Order): Promise<boolean> {
		return this.currentState.handleOrder(order);
	}

	public async transitionToState(newState: State): Promise<void> {
		if (this.currentState.getName() === newState) {
			return;
		}

		await this.currentState.exit();
		this.currentState = this.states.get(newState)!;
		this.lastActionTimestamp = Date.now();
		await this.currentState.enter();
	}

	public async transitionToBuyAsset(order: Order): Promise<boolean> {
		await this.transitionToState(State.BUY_ASSET);
		return this.handleOrder(order);
	}

	public async transitionToSellAsset(order: Order): Promise<boolean> {
		const lastSell = this.lastSellTimestamp.get(order.assetToSell.address) || 0;
		if (Date.now() < lastSell + this.COOLDOWN_PERIOD) {
			throw new Error('Cooldown period not elapsed');
		}

		await this.transitionToState(State.SELL_ASSET);
		return this.handleOrder(order);
	}

	public async returnToIdle(): Promise<boolean> {
		await this.transitionToState(State.IDLE);
		return true;
	}

	// Contract interaction methods
	public async withdrawSVF(amount: number, orderIndex: number): Promise<void> {
		await this.contract.withdrawSVF(amount, orderIndex);
	}

	public async withdrawAsset(amount: number, orderIndex: number): Promise<void> {
		await this.contract.withdrawAsset(amount, orderIndex);
	}

	public async depositSVF(amount: number, orderIndex: number): Promise<void> {
		await this.contract.depositSVF(amount, orderIndex);
	}

	public async depositAsset(amount: number, orderIndex: number): Promise<void> {
		await this.contract.depositAsset(amount, orderIndex);
	}

	public async isTokenWhitelisted(token: string): Promise<boolean> {
		return this.contract.isTokenWhitelisted(token);
	}

	// View methods
	public getState(): State {
		return this.currentState.getName();
	}

	public getLastActionTimestamp(): number {
		return this.lastActionTimestamp;
	}

	public getLastOrderIndex(): number {
		return this.lastOrderIndex;
	}
}
