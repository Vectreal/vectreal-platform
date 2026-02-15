import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import css from '@eslint/css'
import { defineConfig } from 'eslint/config'

export default defineConfig(tseslint.configs.recommended, [
	{
		files: ['**/*.{js,mjs,cjs,jsx}'],
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/public/**'
		],
		plugins: { js },
		extends: ['js/recommended'],
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},

	{
		files: ['**/*.{ts,mts,cts,tsx}'],
		rules: {
			// Core JS rules like no-undef can report false-positives on TS type namespaces
			// (e.g. React, NodeJS). Let TypeScript handle those.
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			]
		}
	},

	{
		...pluginReact.configs.flat.recommended,
		settings: { react: { version: '19' }, runtime: 'automatic' },
		rules: {
			//ignore unused vars prefixed with _ (e.g. _unusedVar)
			'no-unused-vars': 'off', // Turn off base rule as it can report incorrect errors
			'react/react-in-jsx-scope': 'off', // Not needed with React 17+ and new JSX transform
			'react/prop-types': 'off', // Using TypeScript for type checking, so prop-types are redundant
			'react/jsx-uses-react': 'off' // Not needed with React 17+ and new JSX transform
		}
	},
	{
		files: ['**/*.json'],
		ignores: ['**/node_modules/**', '**/package.json'],
		plugins: { json },
		language: 'json/json',
		extends: ['json/recommended']
	},
	{
		files: ['**/*.md'],
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/public/**'
		],
		plugins: { markdown },
		language: 'markdown/gfm',
		extends: ['markdown/recommended']
	},
	{
		files: ['**/*.css'],
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/public/**',
			'**/styles/globals.css'
		],
		plugins: { css },
		language: 'css/css',
		extends: ['css/recommended']
	}
])
