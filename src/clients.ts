import {
	createPublicClient,
	webSocket,
	http,
	createWalletClient,
	type WalletClient,
	type Hex,
	type PublicClient,
	type WebSocketTransportConfig,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';
import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AGI = JSON.parse(
	fs.readFileSync(path.join(__dirname, '../contracts/out/Mock13.sol/Mock13.json'), 'utf8')
);

export const agiContractABI = AGI.abi;

const chainId = parseInt(
	process.env.CHAIN_ID ||
	(() => {
		throw new Error('CHAIN_ID environment variable is required.');
	})()
);

// get contract address
const coreDeploymentData = JSON.parse(
	fs.readFileSync(path.join(__dirname, `../contracts/deployments/agi/${chainId}.json`), 'utf8')
);
export const agiContractAddress = coreDeploymentData.addresses.agi;

const rpc =
	process.env.RPC ||
	(() => {
		throw new Error('RPC environment variable is required.');
	})();

const wssRpc =
	process.env.WSS_RPC ||
	(() => {
		throw new Error('WSS_RPC environment variable is required.');
	})();

const privateKey =
	process.env.PRIVATE_KEY ||
	(() => {
		throw new Error('PRIVATE_KEY environment variable is required.');
	})();

const account = privateKeyToAccount(privateKey as Hex);

logger.info(`Account: ${account.address}`);

// get public client based on chain id
const getPublicClient = (wss: boolean): PublicClient => {
	if (wss) {
		const wsConfig = {
			keepAlive: true,
			reconnect: true,
		} satisfies WebSocketTransportConfig;

		// @ts-expect-error - Known viem type issue with account property
		return createPublicClient({
			chain: anvil,
			transport: webSocket(wssRpc, wsConfig),
		});
	} else {
		// @ts-expect-error - Known viem type issue with account property
		return createPublicClient({
			chain: anvil,
			transport: http(rpc),
		});
	}
};

/// get wallet client based on chain id
const getWalletClient = (): WalletClient =>
	createWalletClient({
		account,
		chain: anvil,
		transport: http(rpc),
	});

export const publicClientHTTP = getPublicClient(false);
export const publicClientWSS = getPublicClient(true);
export const walletClient = getWalletClient();
