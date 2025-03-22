import { Hex, createPublicClient, Chain, webSocket, http, createWalletClient, PublicClient, WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil, baseSepolia } from 'viem/chains';
import 'dotenv/config';

import fs from 'fs';
import path from 'path';


const AGI = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../contracts/out/Mock13.sol/Mock13.json'), 'utf8')
);

export const agiContractABI = AGI.abi;

const chains = [anvil, baseSepolia];
const chainId = parseInt(
  process.env.CHAIN_ID ||
    (() => {
      throw new Error('CHAIN_ID environment variable is required.');
    })()
);

// get contract address
const coreDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `../contracts/deployments/agi/${chainId}.json`),
    'utf8'
  )
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

const privateKey = process.env.PRIVATE_KEY ||
  (() => {
    throw new Error('PRIVATE_KEY environment variable is required.');
  })();

const account = privateKeyToAccount(privateKey as Hex);

	// get public client based on chain id
	const getPublicClient = (wss: boolean, chainId: number) => {
		if (wss) {
			// https://viem.sh/docs/clients/transports/websocket
			return createPublicClient({
				chain: chains.find(chain => chain.id == chainId) as Chain,
				transport: webSocket(wssRpc, {
					keepAlive: true, // or we can set `{ interval: 1_000 },`
					reconnect: true,
				}),
			});
		} else {
			return createPublicClient({
				chain: chains.find(chain => chain.id == chainId) as Chain,
				transport: http(rpc),
			});
		}
	};

	/// get wallet client based on chain id
	const getWalletClient = (chainId: number) =>
		createWalletClient({
			account,
			chain: chains.find(chain => chain.id == chainId) as Chain,
			transport: http(rpc),
		});

	export const publicClientHTTP: PublicClient = getPublicClient(false, chainId);
	export const publicClientWSS: PublicClient = getPublicClient(true, chainId);
	export const walletClient: WalletClient = getWalletClient(chainId);