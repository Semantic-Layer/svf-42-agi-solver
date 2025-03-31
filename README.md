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

AGI Solver is a backend system written in TypeScript designed to reliably fulfill onchain interaction requests (Agent Generated Intents) for AI agents. It serves as a critical bridge between AI agents and blockchain interactions, ensuring reliable execution of complex onchain operations.

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

   then
   under root directory

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
