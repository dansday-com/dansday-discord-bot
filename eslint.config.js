import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const practices = {
	curly: ['error', 'all'],
	eqeqeq: ['error', 'always', { null: 'ignore' }],
	'no-var': 'error',
	'prefer-const': 'error',
	'prefer-template': 'error',
	'default-case': 'error',
	'default-case-last': 'error',
	'no-eval': 'error',
	'no-implied-eval': 'error',
	'no-new-func': 'error',
	'no-void': 'error',
	'no-extend-native': 'error',
	'no-throw-literal': 'error',
	'no-new-wrappers': 'error',
	'no-array-constructor': 'error',
	'no-object-constructor': 'error',
	'@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
	'@typescript-eslint/no-explicit-any': 'warn'
};

const runes = {
	'prefer-const': 'off',
	'svelte/prefer-const': 'error'
};

export default [
	{ ignores: ['build/', 'bots/', 'otel/', '.svelte-kit/', '.claude/', 'graphify-out/', 'static/', 'node_modules/'] },
	{
		files: ['**/*.ts', '**/*.js', '**/*.svelte'],
		plugins: { '@typescript-eslint': ts.plugin, svelte },
		languageOptions: {
			parser: ts.parser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: { ...globals.browser, ...globals.node }
		},
		rules: practices
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: { parser: ts.parser, extraFileExtensions: ['.svelte'], svelteConfig }
		},
		rules: runes
	},
	{
		files: ['**/*.svelte.ts'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: { parser: ts.parser, svelteConfig }
		},
		rules: runes
	}
];
