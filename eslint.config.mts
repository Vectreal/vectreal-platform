import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { defineConfig } from 'eslint/config'
import pluginImport from 'eslint-plugin-import'
import pluginReact from 'eslint-plugin-react'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(tseslint.configs.recommended, [
	{
		// Throwaway consumer app for the @vctrl/viewer packaging e2e. Its deps
		// (@vctrl/viewer, vite, react) only exist in the tmp install created at
		// runtime, so it must not participate in workspace linting.
		//
		// `.claude/worktrees/**` holds temporary git worktrees — full repo copies
		// with their own tsconfig files. Linting them makes typescript-eslint see
		// multiple candidate tsconfigRootDirs and fail to parse every file.
		ignores: [
			'packages/viewer-e2e/src/consumer-template/**',
			'.claude/**'
		]
	},
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
		// Pin the tsconfig root so typescript-eslint never has to guess it. Without
		// this, a second repo copy on disk (e.g. a git worktree) produces multiple
		// candidate roots and the parser throws on every file.
		languageOptions: {
			parserOptions: { tsconfigRootDir: import.meta.dirname }
		},
		plugins: { import: pluginImport },
		rules: {
			// Core JS rules like no-undef can report false-positives on TS type namespaces
			// (e.g. React, NodeJS). Let TypeScript handle those.
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'import/order': [
				'error',
				{
					groups: [
						'builtin',
						'external',
						'internal',
						['parent', 'sibling', 'index'],
						'object',
						'type'
					],
					'newlines-between': 'always',
					alphabetize: {
						order: 'asc',
						caseInsensitive: true
					}
				}
			],
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
		plugins: {
			...pluginReact.configs.flat.recommended.plugins,
			import: pluginImport
		},
		settings: { react: { version: '19' }, runtime: 'automatic' },
		rules: {
			//ignore unused vars prefixed with _ (e.g. _unusedVar)
			'no-unused-vars': 'off', // Turn off base rule as it can report incorrect errors
			'react/react-in-jsx-scope': 'off', // Not needed with React 17+ and new JSX transform
			'react/prop-types': 'off', // Using TypeScript for type checking, so prop-types are redundant
			'react/jsx-uses-react': 'off', // Not needed with React 17+ and new JSX transform
			'import/order': [
				'error',
				{
					groups: [
						'builtin',
						'external',
						'internal',
						['parent', 'sibling', 'index'],
						'object',
						'type'
					],
					'newlines-between': 'always',
					alphabetize: {
						order: 'asc',
						caseInsensitive: true
					}
				}
			]
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
	}
])
