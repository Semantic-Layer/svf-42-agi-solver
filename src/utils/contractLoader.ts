import fs from 'fs';
import path from 'path';

export function loadContractABI(contractName: string) {
	const contractPath = path.join(process.cwd(), `contracts/out/Mock13.sol/Mock13.json`);
	const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
	return contract.abi;
}

// Load Mock13 contract ABI
export const Mock13ABI = loadContractABI('Mock13');
