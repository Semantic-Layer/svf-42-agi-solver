<h1 align="center">AGI Solver</h1>

<p align="center">svf agi solver</p>

<p align="center">
	<a href="https://github.com/Semantic-Layer/svf-agi-solver-internal/blob/main/.github/CODE_OF_CONDUCT.md" target="_blank"><img alt="🤝 Code of Conduct: Kept" src="https://img.shields.io/badge/%F0%9F%A4%9D_code_of_conduct-kept-21bb42" /></a>
	<a href="https://codecov.io/gh/Semantic-Layer/svf-agi-solver-internal" target="_blank"><img alt="🧪 Coverage" src="https://img.shields.io/codecov/c/github/Semantic-Layer/svf-agi-solver-internal?label=%F0%9F%A7%AA%20coverage" /></a>
	<a href="https://github.com/Semantic-Layer/svf-agi-solver-internal/blob/main/LICENSE.md" target="_blank"><img alt="📝 License: MIT" src="https://img.shields.io/badge/%F0%9F%93%9D_license-MIT-21bb42.svg"></a>
	<a href="http://npmjs.com/package/svf-agi-solver-internal"><img alt="📦 npm version" src="https://img.shields.io/npm/v/svf-agi-solver-internal?color=21bb42&label=%F0%9F%93%A6%20npm" /></a>
	<img alt="💪 TypeScript: Strict" src="https://img.shields.io/badge/%F0%9F%92%AA_typescript-strict-21bb42.svg" />
</p>

# AGI Solver

AGI Solver is a backend system written in TypeScript designed to reliably fulfill on-chain interaction requests (Agent Generated Intents) for AI agents. It serves as a critical bridge between AI agents and blockchain interactions, ensuring reliable execution of complex on-chain operations.

## Setup

1. Clone the repository
2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   ```bash
   cd contracts
   cp .env.example .env
   ```

3. Deploy contracts

   start an anvil node first

   ```bash
   anvil
   ```

   then install the dependencies under the `contracts/` foler:

   ```
   forge install
   ```

   finally, under root directory

   ```
   make deploy
   ```

4. Start solver
   ```
   make start
   ```
5. Publish an agi

   ```bash
   #e.g.
   make sellTokenA
   ```

## Development

See [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md), then [`.github/DEVELOPMENT.md`](./.github/DEVELOPMENT.md).
Thanks! 💖

<!-- You can remove this notice if you don't want it 🙂 no worries! -->

> 💝 This package was templated with [`create-typescript-app`](https://github.com/JoshuaKGoldberg/create-typescript-app) using the [Bingo engine](https://create.bingo).

# AGI Queue Manager

The AGI Queue Manager is a system that manages the processing queue of Agent Generated Intents (AGIs). It handles the lifecycle of AGI tasks from creation to completion, including asset withdrawal, swapping, and deposit operations.

## Order Processing Flow

### 1. Queue Management

- Items are added to queue via `add(agiId)`
- When processing starts, items are moved to end of queue before processing
- Items are only removed from queue when fully completed (status 2)
- Tasks that have failed swaps after MAX_RETRIES attempts will be skipped and removed from queue

### 2. Status Flow

#### a. Initial State (0 - PendingDispense)

- Withdraw asset from contract
- Contract status becomes 1

#### b. After Withdraw (1 - DispensedPendingProceeds)

- Set internal status to 3 (SwapInitiated)
- Begin swap operation

#### c. Swap Initiated (3 - SwapInitiated)

- Perform swap operation
- Set internal status to 4 (SwapCompleted) when swap is done

#### d. After Swap (4 - SwapCompleted)

- Deposit swapped assets back to the contract
- Set internal status to 2 (ProceedsReceived)

#### e. Final State (2 - ProceedsReceived)

- Clean up internal state
- Remove from queue

### 3. Status Selection Logic

- Use contract status as primary source of truth
- Only use internal SwapCompleted status when:
  - Contract status is 1 (DispensedPendingProceeds)
  - And we have an internal status (not undefined)

### 4. Transaction Handling

- Wait for transaction confirmation before proceeding
- Handle transaction failures gracefully
- Keep items in queue until fully processed

### 5. Queue Processing

- Process one item at a time
- Move items to end of queue before processing
- Only remove items when fully completed
- Maintain FIFO order while allowing other items to be processed

## Implementation Details

The queue manager is implemented in TypeScript and uses a combination of contract interactions and internal state management to track the progress of each AGI task. It includes retry mechanisms for failed operations and maintains a strict order of operations to ensure the integrity of the asset swapping process.

### Key Features

- Automatic retry of failed operations
- Transaction confirmation waiting
- FIFO queue processing
- State management for both contract and internal states
- Error handling and logging
- Configurable retry limits and delays

### Error Handling

- Failed swaps are retried up to MAX_RETRIES times
- Tasks exceeding retry limits are removed from the queue
- Transaction failures are handled gracefully with appropriate logging
- System maintains queue integrity even during failures
