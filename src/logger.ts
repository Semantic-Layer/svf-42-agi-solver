// Color constants for terminal output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	red: '\x1b[31m',
};

// Logger helper for elegant colored console logs
export const logger = {
	// Separator line
	separator: () =>
		console.log(
			'======================================================================================='
		),

	// Main header logs with different colors
	info: (message: string) => console.log(`${colors.cyan}[SVF:42 COPIUM] ${message}${colors.reset}`),
	success: (message: string) =>
		console.log(`${colors.green}[SVF:42 COPIUM] ${message}${colors.reset}`),
	warning: (message: string) =>
		console.log(`${colors.yellow}[SVF:42 COPIUM] ${message}${colors.reset}`),
	process: (message: string) =>
		console.log(`${colors.blue}[SVF:42 COPIUM] ${message}${colors.reset}`),
	event: (message: string) =>
		console.log(`${colors.magenta}[SVF:42 COPIUM] ${message}${colors.reset}`),
	error: (message: string) => console.log(`${colors.red}[SVF:42 COPIUM] ${message}${colors.reset}`),

	// Content logs (for details under headers)
	item: (message: string) => console.log(` > ${message}`),
	subItem: (message: string) => console.log(`   * ${message}`),
};

// Export default for convenience
export default logger;
