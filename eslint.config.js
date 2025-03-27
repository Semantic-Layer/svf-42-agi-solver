import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/lib/**',
			'**/contracts/**',
			'**/pnpm-lock.yaml',
		],
	},
	{ linterOptions: { reportUnusedDisableDirectives: 'error' } },
	eslint.configs.recommended,
	{
		extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
		files: ['src/**/*.{js,ts}'],
		languageOptions: {
			parserOptions: {
				projectService: { allowDefaultProject: ['*.config.*s'] },
				tsconfigRootDir: import.meta.dirname,
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': 'warn',
		},
	}
);
