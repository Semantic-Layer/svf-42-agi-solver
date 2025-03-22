import logger from './logger';
import startListener from './solver';

startListener().catch(error => {
	logger.item('Error starting listener:');
	logger.error(error);
	process.exit(1);
});
