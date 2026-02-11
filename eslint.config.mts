import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import css from '@eslint/css'
import { defineConfig } from 'eslint/config'

export default defineConfig([
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		plugins: { js },
		extends: ['js/recommended'],
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},
	tseslint.configs.recommended,
	{
		...pluginReact.configs.flat.recommended,
		settings: { react: { version: '19' } },
		rules: {
			'react/react-in-jsx-scope': 'off', // Not needed with React 17+ and new JSX transform
			'react/prop-types': 'off', // Using TypeScript for type checking, so prop-types are redundant
			'react/jsx-uses-react': 'off' // Not needed with React 17+ and new JSX transform
		}
	}, // Use React plugin with auto-detected version
	{
		files: ['**/*.json'],
		ignores: ['**/node_modules/**', '**/package.json'],
		plugins: { json },
		language: 'json/json',
		extends: ['json/recommended']
	},
	{
		files: ['**/*.md'],
		plugins: { markdown },
		language: 'markdown/gfm',
		extends: ['markdown/recommended']
	},
	{
		files: ['**/*.css'],
		plugins: { css },
		language: 'css/css',
		extends: ['css/recommended']
	}
])
