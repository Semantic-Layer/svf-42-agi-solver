import {
	createPublicClient,
	webSocket,
	http,
	PrivateKeyAccount,
	createWalletClient,
	type WalletClient,
	type Hex,
	type PublicClient,
	type WebSocketTransportConfig,
	type Chain,
	Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil, base, baseSepolia } from 'viem/chains';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import logger from './logger.ts';

interface ChainConfig {
	chainId: number;
	rpcUrl: string;
	wssRpcUrl: string;
	privateKey: Hex;
	agiContractAddress: string;
}

interface BlockchainServices {
	publicClientHTTP: PublicClient;
	publicClientWSS: PublicClient;
	walletClient: WalletClient;
	account: PrivateKeyAccount;
	chains: Chain[];
	chainId: number;
	agiContractABI: Abi;
	agiContractAddress: string;
	IERC20ABI: Abi;
}

/**
 * Initialize chain configuration from environment variables
 */
function initializeConfig(): ChainConfig {
	const { CHAIN_ID, RPC, WSS_RPC, PRIVATE_KEY } = process.env;

	if (!CHAIN_ID || !RPC || !WSS_RPC || !PRIVATE_KEY) {
		throw new Error('Missing required chain configuration parameters');
	}

	const chainId = parseInt(CHAIN_ID);

	// Load contract deployment data
	const coreDeploymentData = JSON.parse(
		fs.readFileSync(path.join(process.cwd(), `contracts/deployments/agi/${chainId}.json`), 'utf8')
	);

	let agiContractAddress = '';
	if (process.env.MODE === 'PRODUCTION') {
		agiContractAddress = process.env.WAREHOUSE13_ADDRESS!;
	} else {
		agiContractAddress = coreDeploymentData.addresses.agi;
	}

	return {
		chainId,
		rpcUrl: RPC,
		wssRpcUrl: WSS_RPC,
		privateKey: PRIVATE_KEY as Hex,
		agiContractAddress: agiContractAddress,
	};
}

/**
 * Initialize blockchain clients and contract configurations
 */
function initializeClients(): BlockchainServices {
	const config = initializeConfig();
	const chains = [base, baseSepolia, anvil];

	// Initialize chain configuration
	const chainConfig = {
		chain: chains.find(chain => chain.id === config.chainId) as Chain,
	};

	// Initialize account
	const account = privateKeyToAccount(config.privateKey);
	logger.info(`Account: ${account.address}`);

	// Load contract ABI
	let AGI;
	if (process.env.MODE === 'PRODUCTION') {
		AGI = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'abi/warehouse13.json'), 'utf8'));
	} else {
		AGI = JSON.parse(
			fs.readFileSync(path.join(process.cwd(), 'contracts/out/Mock13.sol/Mock13.json'), 'utf8')
		);
	}

	const IERC20ABI = JSON.parse(
		fs.readFileSync(path.join(process.cwd(), 'abi/IERC20.json'), 'utf8')
	).abi;

	// Initialize public clients
	const publicClientHTTP = createPublicClient({
		...chainConfig,
		transport: http(config.rpcUrl),
	});

	const wsConfig: WebSocketTransportConfig = {
		keepAlive: true,
		reconnect: true,
	};

	const publicClientWSS = createPublicClient({
		...chainConfig,
		transport: webSocket(config.wssRpcUrl, wsConfig),
	});

	// Initialize wallet client
	const walletClient = createWalletClient({
		account,
		...chainConfig,
		transport: http(config.rpcUrl),
	});

	return {
		publicClientHTTP,
		publicClientWSS,
		walletClient,
		account,
		chains,
		chainId: config.chainId,
		agiContractABI: AGI.abi,
		agiContractAddress: config.agiContractAddress,
		IERC20ABI,
	};
}

// Initialize and export blockchain clients and configurations
const {
	publicClientHTTP,
	publicClientWSS,
	walletClient,
	account,
	chains,
	chainId,
	agiContractABI,
	agiContractAddress,
	IERC20ABI,
}: BlockchainServices = initializeClients();

export {
	publicClientHTTP,
	publicClientWSS,
	walletClient,
	account,
	chains,
	chainId,
	agiContractABI,
	agiContractAddress,
	IERC20ABI,
};
