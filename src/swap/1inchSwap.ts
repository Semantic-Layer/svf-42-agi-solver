// https://portal.1inch.dev/documentation/apis/swap/classic-swap/quick-start

// TODO: not test yet, need KYC to create an API account

// Step 2: Set up your environment
const Web3 = require('web3');
const fetch = require('node-fetch');
const yesno = require('yesno');

const chainId = 8453; // Chain ID for Base
const web3RpcUrl = process.env.RPC; // URL for Base node
const walletAddress = '0x7341E2bE8a83F493b766b4DD28fCEAC7C5267996'; // Your wallet address
const privateKey = process.env.PRIVATE_KEY; // Your wallet's private key. NEVER SHARE THIS WITH ANYONE!
const API_KEY = process.env.API_KEY;

// Step 3: Define your swap parameters
const swapParams = {
	src: '0x4eeaccd388d6807da7aad403c60d79135526639c', // Token address of SVFToken
	dst: '0x4200000000000000000000000000000000000006', // Token address of DAI
	amount: '1234567890', // Amount of SVFToken to swap (in wei)
	from: walletAddress,
	slippage: 1, // Maximum acceptable slippage percentage for the swap (e.g., 1 for 1%)
	disableEstimate: false, // Set to true to disable estimation of swap details
	allowPartialFill: false, // Set to true to allow partial filling of the swap order
};

// Step 4: Define API URLs, Your API Key here and initialize Web3 libraries
const broadcastApiUrl = 'https://api.1inch.dev/tx-gateway/v1.1/' + chainId + '/broadcast';
const apiBaseUrl = 'https://api.1inch.dev/swap/v6.0/' + chainId;
const web3 = new Web3(web3RpcUrl);
const headers = { headers: { Authorization: API_KEY, accept: 'application/json' } };

// Step 5: Define Helper Functions
// Construct full API request URL
function apiRequestUrl(methodName: any, queryParams: any) {
	return apiBaseUrl + methodName + '?' + new URLSearchParams(queryParams).toString();
}

// Post raw transaction to the API and return transaction hash
async function broadCastRawTransaction(rawTransaction: any) {
	return fetch(broadcastApiUrl, {
		method: 'post',
		body: JSON.stringify({ rawTransaction }),
		headers: { 'Content-Type': 'application/json', Authorization: API_KEY },
	})
		.then((res: any) => res.json())
		.then((res: any) => {
			return res.transactionHash;
		});
}

// Sign and post a transaction, return its hash
async function signAndSendTransaction(transaction: any) {
	const { rawTransaction } = await web3.eth.accounts.signTransaction(transaction, privateKey);

	return await broadCastRawTransaction(rawTransaction);
}

// Step 6: Check Token Allowance
async function buildTxForApproveTradeWithRouter(tokenAddress: any, amount: any) {
	const url = apiRequestUrl(
		'/approve/transaction',
		amount ? { tokenAddress, amount } : { tokenAddress }
	);

	const transaction = await fetch(url, headers).then((res: any) => res.json());

	const gasLimit = await web3.eth.estimateGas({
		...transaction,
		from: walletAddress,
	});

	return {
		...transaction,
		gas: gasLimit,
	};
}

const transactionForSign = await buildTxForApproveTradeWithRouter(
	swapParams.src,
	swapParams.amount
);
console.log('Transaction for approve: ', transactionForSign);

const ok = await yesno({
	question: 'Do you want to send a transaction to approve trade with 1inch router?',
});

if (!ok) {
	console.log('Transaction not approved');
}

const approveTxHash = await signAndSendTransaction(transactionForSign);
console.log('Approve tx hash: ', approveTxHash);

async function buildTxForSwap(swapParams: any) {
	const url = apiRequestUrl('/swap', swapParams);

	// Fetch the swap transaction details from the API
	return fetch(url, headers)
		.then((res: any) => res.json())
		.then((res: any) => res.tx);
}

const swapTransaction = await buildTxForSwap(swapParams);
console.log('Transaction for swap: ', swapTransaction);

const ok2 = await yesno({
	question: 'Do you want to send a transaction to exchange with 1inch router?',
});

if (!ok2) {
	console.log('Transaction not approved');
}

const swapTxHash = await signAndSendTransaction(swapTransaction);
console.log('Swap tx hash: ', swapTxHash);
