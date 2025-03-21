# AGI Solver

AGI Solver is a backend system written in TypeScript designed to reliably fulfill onchain interaction requests (Agent Generated Intents) for AI agents. It serves as a critical bridge between AI agents and blockchain interactions, ensuring reliable execution of complex onchain operations.

## Overview

The AGI Solver system consists of two main components:

1. **TypeScript Backend**: Handles the complex logic of executing onchain interactions reliably, managing:

   - Transaction execution and retry logic

2. **Smart Contract System** (`mock13/`): Provides the onchain infrastructure for:
   - Publishing agent intents
   - Managing agent assets
   - Serving as a smart contract wallet for agents

## Smart Contract Architecture

The `mock13/` folder contains the onchain component of the AGI Solver system:

### Key Contracts

- `Mock13.sol`: The main contract serving as a smart contract wallet for agents
- `TokenA.sol` & `TokenB.sol`: Test tokens for demonstrating trading functionality

### Key Features

1. **Intent Publication**

   ```solidity
   function publishAGI(
       uint8 intentType,
       address assetToSell,
       uint256 amountToSell,
       address assetToBuy
   )
   ```

   Agents can publish their trading intents through this function.

2. **Asset Management**
   - The contract acts as a secure wallet for agent assets
   - Supports ERC20 token interactions
   - Manages trade execution and asset transfers

### Deployed Contracts (Base Sepolia)

- Mock13: `0x538Dd1dB653bbF7376CF8C57C6bF68805Cf01166`
- TokenA: `0x011228A36559f2029982bB75947BD3CAc2Eb9fF9`
- TokenB: `0x0B44519951121D60b3241272ADeBA7a944B63761`

## Integration with Semantic Layer

AGI Solver is designed to be integrated into the Semantic Layer ecosystem and will be a key component in the upcoming Silicon Valley Fun product release. This integration allows:

1. AI agents to focus on high-level decision making and reasoning
2. AGI Solver to handle all complex onchain interactions
3. Reliable execution of agent-generated intents
4. Seamless interaction with DEXes and lending protocols

## Purpose

The project addresses several key challenges in onchain AI agent interactions:

- Complex transaction management
- Failed transaction handling
- Optimal execution strategies
- Gas optimization
- RPC reliability

By separating the execution layer (AGI Solver) from the reasoning layer (AI agents), we create a more robust and reliable system for onchain AI interactions.

## Development

### Prerequisites

- Node.js
- Foundry
- TypeScript

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

### Testing

```bash
# Smart Contract Tests
cd mock13
forge test

# Backend Tests
npm test
```

## Contributing

We welcome contributions! Please see our contributing guidelines for more details.

## License

MIT
