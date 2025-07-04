import logger from './logger.ts';
import startListener from './solver.ts';
import chalk from 'chalk';
import figlet from 'figlet';
import { agiContractAddress, chainId } from './clients.ts';

console.log('\n');
console.log(
	chalk.hex('#FFA500')(
		figlet.textSync('SVF AGI Solver', {
			font: 'Standard',
			horizontalLayout: 'default',
			verticalLayout: 'default',
		})
	)
);

logger.item(`Listening for events at address: ${agiContractAddress} at chainId: ${chainId}`);
logger.separator();

startListener().catch(error => {
	logger.item('Error starting listener:');
	logger.error(error);
	process.exit(1);
});
