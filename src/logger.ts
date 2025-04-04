import winston from 'winston';

// Color constants for terminal output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[94m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	red: '\x1b[31m',
	lightGray: '\x1b[37m',
	lightBlue: '\x1b[94m',
	lightCyan: '\x1b[96m',
};

// winston logger configuration
const loggerTransports = {
	console: new winston.transports.Console({
		format: winston.format.combine(
			winston.format.timestamp({
				format: () => {
					const now = new Date();
					return now // `undefined`, will automatically use the system's default region
						.toLocaleString(undefined, {
							year: 'numeric',
							month: '2-digit',
							day: '2-digit',
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
							hour12: false,
						})
						.replace(/\//g, '-');
				},
			}),
			winston.format.printf(({ timestamp, message }) => `[${timestamp}] ${message}`)
		),
	}),
	successFile: new winston.transports.File({
		filename: 'logs/success.log',
		level: 'info', // only accept info level
		format: winston.format.combine(
			winston.format.timestamp({
				format: () => {
					const now = new Date();
					return now // `undefined`, will automatically use the system's default region
						.toLocaleString(undefined, {
							year: 'numeric',
							month: '2-digit',
							day: '2-digit',
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
							hour12: false,
						})
						.replace(/\//g, '-');
				},
			}),
			winston.format.printf(({ timestamp, message }) => `[${timestamp}] ${message}`)
		),
	}),
	errorFile: new winston.transports.File({
		filename: 'logs/fail.log',
		level: 'error', // only accept error level
		format: winston.format.combine(
			winston.format.timestamp({
				format: () => {
					const now = new Date();
					return now // `undefined`, will automatically use the system's default region
						.toLocaleString(undefined, {
							year: 'numeric',
							month: '2-digit',
							day: '2-digit',
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
							hour12: false,
						})
						.replace(/\//g, '-');
				},
			}),
			winston.format.printf(({ timestamp, message }) => `[${timestamp}] ${message}`)
		),
	}),
	failedSwapFile: new winston.transports.File({
		filename: 'logs/failed_swaps.log',
		level: 'error',
		format: winston.format.combine(
			winston.format.timestamp({
				format: () => {
					const now = new Date();
					return now // `undefined`, will automatically use the system's default region
						.toLocaleString(undefined, {
							year: 'numeric',
							month: '2-digit',
							day: '2-digit',
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
							hour12: false,
						})
						.replace(/\//g, '-');
				},
			}),
			winston.format.printf(({ timestamp, message }) => `[${timestamp}] ${message}`)
		),
	}),
};

// create logger instance
const winstonLogger = winston.createLogger({
	levels: winston.config.npm.levels,
	transports: [loggerTransports.console, loggerTransports.successFile, loggerTransports.errorFile],
});

// create separate logger for failed swaps
const failedSwapLogger = winston.createLogger({
	levels: winston.config.npm.levels,
	transports: [loggerTransports.failedSwapFile],
});

// custom logger, keep colors and adapt to file output
export const logger = {
	separator: () => {
		const separator =
			'=======================================================================================';
		console.log(separator); // only output to console
	},

	info: (message: string) => {
		const logMessage = `[SVF:42 SOLVER] ${message}`;
		winstonLogger.info({
			message: logMessage, // file output pure text
			consoleMessage: `${colors.cyan}${logMessage}${colors.reset}`, // console with colors
		});
	},
	success: (message: string) => {
		const logMessage = `[SVF:42 SOLVER] ${message}`;
		winstonLogger.info({
			message: logMessage,
			consoleMessage: `${colors.green}${logMessage}${colors.reset}`,
		});
	},
	warning: (message: string) => {
		const logMessage = `[SVF:42 SOLVER] ${message}`;
		winstonLogger.info({
			message: logMessage,
			consoleMessage: `${colors.yellow}${logMessage}${colors.reset}`,
		});
	},
	process: (message: string) => {
		const logMessage = `[SVF:42 SOLVER] ${message}`;
		winstonLogger.info({
			message: logMessage,
			consoleMessage: `${colors.blue}${logMessage}${colors.reset}`,
		});
	},
	event: (message: string) => {
		const logMessage = `[SVF:42 SOLVER] ${message}`;
		winstonLogger.info({
			message: logMessage,
			consoleMessage: `${colors.magenta}${logMessage}${colors.reset}`,
		});
	},
	error: (message: string) => {
		const logMessage = `[SVF:42 SOLVER] ${message}`;
		winstonLogger.error({
			message: logMessage,
			consoleMessage: `${colors.red}${logMessage}${colors.reset}`,
		});
	},

	failedSwap: (message: string) => {
		const logMessage = `[SVF:42 SOLVER] ${message}`;
		failedSwapLogger.error(logMessage);
		console.log(`${colors.red}${logMessage}${colors.reset}`);
	},

	item: (message: string) => {
		const logMessage = ` > ${message}`;
		winstonLogger.info({
			message: logMessage,
			consoleMessage: `${colors.lightBlue}${logMessage}${colors.reset}`, // item does not need colors
		});
	},
	subItem: (message: string) => {
		const logMessage = `   * ${message}`;
		winstonLogger.info({
			message: logMessage,
			consoleMessage: logMessage, // subItem does not need colors
		});
	},
};

// custom format, distinguish console and file output
winstonLogger.format = winston.format.combine(
	winston.format(info => {
		// if consoleMessage exists, use it as console output, otherwise use message
		info.message = info.consoleMessage || info.message;
		return info;
	})()
);

export default logger;
