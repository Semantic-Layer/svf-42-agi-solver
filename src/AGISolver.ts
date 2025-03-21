import { Order, State, IMock13, Asset, AgentGeneratedIntent, LiFiTrade } from './types';
import { IState } from './states/BaseState';
import { IdleState } from './states/IdleState';
import { BuyAssetState } from './states/BuyAssetState';
import { SellAssetState } from './states/SellAssetState';
import { LogErrorState } from './states/LogErrorState';
import { HandleFatalErrorState } from './states/HandleFatalErrorState';
import { ethers } from 'ethers';
import PQueue from 'p-queue';
import path from 'path';
import fs from 'fs';

export class AGISolver {
	public readonly SVF_TOKEN: `0x${string}` = '0x011228A36559f2029982bB75947BD3CAc2Eb9fF9' as const; // SVF token on Base Sepolia
	private readonly COOLDOWN_PERIOD: number = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
	private readonly STATE_FILE_PATH: string = path.join(
		process.cwd(),
		'data',
		'agi-solver-state.json'
	);

	private currentState: IState;
	private lastOrderIndex: number;
	private lastActionTimestamp: number;
	private lastSellTimestamp: Map<string, number>;
	private contract: IMock13;
	private states: Map<State, IState>;
	private activeTrades: Map<number, LiFiTrade>;
	private provider: ethers.JsonRpcProvider;
	private wallet: ethers.Wallet;
	private queue: PQueue;
	private isProcessing: boolean = false;

	constructor(contractInstance: IMock13, provider: ethers.JsonRpcProvider, privateKey: string) {
		this.contract = contractInstance;
		this.provider = provider;
		this.wallet = new ethers.Wallet(privateKey, provider);
		this.lastOrderIndex = 0;
		this.lastActionTimestamp = Date.now();
		this.lastSellTimestamp = new Map();
		this.activeTrades = new Map();

		// Initialize processing queue
		this.queue = new PQueue({
			concurrency: 1,
			interval: 1000,
			intervalCap: 1,
		});

		// Queue event listeners
		this.queue.on('active', () => {
			console.log(`Processing AGI. Queue size: ${this.queue.size} pending`);
		});

		this.queue.on('completed', () => {
			console.log(`AGI processed. Remaining in queue: ${this.queue.size}`);
		});

		this.queue.on('error', (error: Error) => {
			console.error('Queue processing error:', error);
		});

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

	public async start(): Promise<void> {
		await this.initialize();
		console.log('AGISolver started successfully');
	}

	private async initialize(): Promise<void> {
		try {
			// Get current block number
			const currentBlock = await this.provider.getBlockNumber();

			// Load last processed block
			const lastProcessed = await this.loadLastProcessedBlock();

			// Process missed events if necessary
			if (lastProcessed > 0 && currentBlock > lastProcessed) {
				console.log(`Found gap in processed blocks: ${lastProcessed} -> ${currentBlock}`);
				await this.processMissedEvents(lastProcessed, currentBlock);
			} else {
				await this.saveLastProcessedBlock(currentBlock);
			}

			await this.setupEventListeners();
		} catch (error) {
			console.error('Error initializing AGISolver:', error);
			throw error;
		}
	}

	private async setupEventListeners(): Promise<void> {
		// Listen for AGIPublished events
		this.contract.on('AGIPublished', async (orderIndex: number) => {
			await this.queue.add(async () => {
				try {
					await this.processAGI(orderIndex);
				} catch (error) {
					console.error(`Error processing AGI ${orderIndex}:`, error);
				}
			});
		});
	}

	private async processAGI(orderIndex: number): Promise<void> {
		if (this.isProcessing) return;

		try {
			this.isProcessing = true;
			const agi = await this.contract.viewAGI(orderIndex);

			if (agi && agi.orderStatus === 0) {
				const order: Order = {
					orderId: agi.orderIndex,
					assetToSell: { address: agi.assetToSell, balance: agi.amountToSell },
					assetToBuy: { address: agi.assetToBuy, balance: 0 },
					amount: agi.amountToSell,
					intentType: agi.intentType,
					orderStatus: agi.orderStatus,
				};

				if (agi.intentType === 0) {
					// Trade intent
					if (agi.assetToSell === this.SVF_TOKEN) {
						await this.transitionToBuyAsset(order);
					} else {
						await this.transitionToSellAsset(order);
					}
				}
			}

			// Update last processed block
			const currentBlock = await this.provider.getBlockNumber();
			await this.saveLastProcessedBlock(currentBlock);
		} catch (error) {
			console.error('Error processing AGI:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	private async processMissedEvents(fromBlock: number, toBlock: number): Promise<void> {
		const filter = this.contract.filters.AGIPublished();
		const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

		for (const event of events) {
			const orderIndex = event.args![0].toNumber();
			await this.processAGI(orderIndex);
		}
	}

	private async loadLastProcessedBlock(): Promise<number> {
		try {
			if (fs.existsSync(this.STATE_FILE_PATH)) {
				const data = JSON.parse(fs.readFileSync(this.STATE_FILE_PATH, 'utf8'));
				return data.lastProcessedBlock || 0;
			}
		} catch (error) {
			console.error('Error loading last processed block:', error);
		}
		return 0;
	}

	private async saveLastProcessedBlock(blockNumber: number): Promise<void> {
		try {
			const dir = path.dirname(this.STATE_FILE_PATH);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				this.STATE_FILE_PATH,
				JSON.stringify({ lastProcessedBlock: blockNumber }),
				'utf8'
			);
		} catch (error) {
			console.error('Error saving last processed block:', error);
		}
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

	public getPrivateKey(): `0x${string}` {
		return this.wallet.privateKey as `0x${string}`;
	}

	public getContractAddress(): `0x${string}` {
		// For testing, using the deployed contract address from Base Sepolia
		return '0x538Dd1dB653bbF7376CF8C57C6bF68805Cf01166' as const;
	}

	// LiFi integration methods (to be implemented)
	private async getQuote(fromToken: string, toToken: string, amount: string): Promise<any> {
		// TODO: Implement LiFi quote fetching
		throw new Error('Not implemented');
	}

	private async executeTrade(quote: any): Promise<any> {
		// TODO: Implement LiFi trade execution
		throw new Error('Not implemented');
	}
}
