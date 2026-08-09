import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { defineConfig } from 'eslint/config'
import pluginImport from 'eslint-plugin-import-x'
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
			'.claude/**',
			// Built Storybook output. Gitignored, but lint globs still reach it.
			'**/storybook-static/**'
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
	/*
	  Design-system adherence.

	  Both rules encode a failure this consolidation actually hit, more than once
	  each, and that nothing else catches.
	*/
	{
		files: ['apps/**/*.{ts,tsx}', 'shared/**/*.{ts,tsx}'],
		ignores: [
			// Mail clients do not resolve custom properties, so email templates
			// must inline their hex.
			'**/lib/email/templates/**',
			// Stories deliberately show raw values beside their tokens.
			'**/*.stories.tsx',
			// Specs assert on literal class strings.
			'**/*.spec.ts',
			'**/*.spec.tsx'
		],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					/*
					  A Tailwind variant on a `ds-*` or `.text-*` class.

					  Those classes live in `@layer components` and are not registered
					  utilities, so a variant has nothing to attach to and Tailwind
					  emits no rule at all. It fails silently - the class is in the
					  markup and simply does nothing. `hover:ds-overlay`,
					  `focus-within:ds-overlay` and
					  `group-data-[viewport=false]/navigation-menu:ds-overlay` all
					  shipped past review during this sweep before being caught by
					  reading built CSS.

					  Write the value as an arbitrary utility instead:
					  `hover:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))]`.
					*/
					selector:
						'Literal[value=/(^|\\s)[a-z][a-z0-9-]*(\\[[^\\]]*\\])?(\\/[a-z-]+)?:(ds-(raised|overlay|sunken|divider)|text-(display|headline|h2|h3|stat|body-lg|eyebrow|label-xs))/]',
					message:
						'Tailwind variants cannot be applied to ds-* or text-* design-system classes: they are @layer components rules, not utilities, so this generates nothing. Use an arbitrary value, e.g. hover:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))].'
				},
				{
					/*
					  A raw hex colour in a Tailwind arbitrary value.

					  Colours belong to the token set. Where a literal is genuinely
					  correct - depicting someone else's interface, for instance - hoist
					  it to a named constant with a comment, which also takes it out of
					  the class string and past this rule.
					*/
					selector:
						'Literal[value=/(bg|text|border|from|via|to|fill|stroke|shadow|ring|outline|decoration|accent|caret)-\\[#[0-9a-fA-F]{3,8}/]',
					message:
						'Raw hex in a Tailwind class. Use a design token (bg-orange, text-muted-foreground, ds-raised) or, for a colour that must not follow the theme, a named constant with a comment saying why.'
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
