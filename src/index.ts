import logger from './logger.ts';
import startListener from './solver.ts';

startListener().catch(error => {
	logger.item('Error starting listener:');
	logger.error(error);
	process.exit(1);
});
