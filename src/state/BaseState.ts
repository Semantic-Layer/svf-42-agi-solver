import { Order, State } from '../types';
import { AGISolver } from '../AGISolver';

export interface IState {
    enter(): Promise<void>;
    exit(): Promise<void>;
    handleOrder(order: Order): Promise<boolean>;
    getName(): State;
}

export abstract class BaseState implements IState {
    protected context: AGISolver;

    constructor(context: AGISolver) {
        this.context = context;
    }

    abstract enter(): Promise<void>;
    abstract exit(): Promise<void>;
    abstract handleOrder(order: Order): Promise<boolean>;
    abstract getName(): State;

    protected async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} 