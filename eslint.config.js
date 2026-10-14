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
	'no-proto': 'error',
	'no-caller': 'error',
	'no-script-url': 'error',
	'no-implicit-globals': 'error',
	'no-useless-concat': 'error',
	'prefer-promise-reject-errors': 'error',
	'prefer-spread': 'error',
	'prefer-rest-params': 'error',
	'prefer-object-spread': 'error',
	'default-param-last': 'error',
	'no-useless-return': 'error',
	'no-useless-catch': 'error',
	'no-lonely-if': 'error',
	'no-else-return': 'error',
	'no-unneeded-ternary': 'error',
	'no-param-reassign': 'error',
	'prefer-exponentiation-operator': 'error',
	'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
	'no-empty': ['error', { allowEmptyCatch: true }],
	'no-multi-assign': 'error',
	'init-declarations': ['error', 'always'],
	'max-params': ['error', 3],
	'max-depth': ['error', 4],
	'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
	'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
	'no-restricted-syntax': [
		'error',
		{
			selector: "AssignmentExpression[left.type='MemberExpression'][left.property.name='length']",
			message: 'Clear or truncate arrays with splice instead of writing to length.'
		}
	],
	'@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
	'@typescript-eslint/no-explicit-any': 'error'
};

const typed = {
	'@typescript-eslint/prefer-destructuring': [
		'error',
		{ VariableDeclarator: { object: true, array: false }, AssignmentExpression: { object: false, array: false } }
	],
	'@typescript-eslint/only-throw-error': 'error',
	'@typescript-eslint/prefer-promise-reject-errors': 'error',
	'@typescript-eslint/naming-convention': [
		'error',
		{
			selector: ['variable', 'parameter'],
			types: ['boolean'],
			format: null,
			leadingUnderscore: 'allow',
			custom: { regex: '^((is|has|are|can|should|did|was|will|does)[A-Z0-9_]|[A-Z][A-Z0-9_]*$)', match: true }
		}
	]
};

const magicNumbers = {
	'@typescript-eslint/no-magic-numbers': [
		'error',
		{
			ignore: [-1, 0, 1, 2],
			ignoreArrayIndexes: true,
			ignoreDefaultValues: true,
			ignoreClassFieldInitialValues: true,
			ignoreEnums: true,
			ignoreNumericLiteralTypes: true,
			ignoreReadonlyClassProperties: true,
			ignoreTypeIndexes: true
		}
	]
};

const numericDataModules = [
	'src/lib/frontend/fx/**/*.ts',
	'src/lib/effects.ts',
	'src/lib/frontend/sfx.ts',
	'src/lib/frontend/components/landing/globe.ts',
	'src/lib/backend/demo/seedDemo.ts'
];

const runes = {
	'prefer-const': 'off',
	'svelte/prefer-const': 'error'
};

export default [
	{ ignores: ['build/', 'bots/', 'otel/', '.svelte-kit/', '.claude/', '.probe/', '.fxprof/', 'graphify-out/', 'static/', 'node_modules/'] },
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
		files: ['src/lib/frontend/fx/**/*.ts'],
		rules: { 'max-params': 'off', 'max-depth': 'off', 'max-lines-per-function': 'off' }
	},
	{
		files: ['src/**/*.ts', 'src/**/*.svelte', '*.ts'],
		ignores: numericDataModules,
		rules: magicNumbers
	},
	{
		files: ['src/**/*.ts', 'tests/**/*.ts'],
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
		},
		rules: typed
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
