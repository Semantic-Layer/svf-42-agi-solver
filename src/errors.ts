export class NoRoutesFoundError extends Error {
	constructor(message: string = 'No swap routes found for the given tokens') {
		super(message);
		this.name = 'NoRoutesFoundError';
	}
}

export class MaxRetriesExceededError extends Error {
	constructor(message: string = 'Maximum number of retries exceeded') {
		super(message);
		this.name = 'MaxRetriesExceededError';
	}
}

export class SwapError extends Error {
	originalError: Error | unknown;

	constructor(message: string, originalError: Error | unknown) {
		super(message);
		this.name = 'SwapError';
		this.originalError = originalError;
	}
}
