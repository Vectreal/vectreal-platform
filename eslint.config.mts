import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import nx from '@nx/eslint-plugin'
import { defineConfig } from 'eslint/config'
import * as jsoncParser from 'jsonc-eslint-parser'
import pluginImport from 'eslint-plugin-import-x'
import pluginReact from 'eslint-plugin-react'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Build tooling and test/story files are not part of what a consumer installs.
const dependencyCheckOptions = {
	buildTargets: ['build', 'build-ci', 'build-storybook'],
	ignoredFiles: [
		'{projectRoot}/vite.config.ts',
		'{projectRoot}/vitest.config.ts',
		'{projectRoot}/vitest.integration.config.ts',
		'{projectRoot}/react-router.config.ts',
		'{projectRoot}/**/*.stories.tsx',
		'{projectRoot}/**/*.spec.{ts,tsx}'
	]
}

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
			'**/*.spec.tsx',
			// The icon components are where inline SVG is supposed to live.
			'**/assets/icons/**'
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
				},
				{
					/*
					  A className built by interpolation instead of `cn()`.

					  `cn()` is clsx plus tailwind-merge, and the merge is the point:
					  `cn('p-2', className)` lets a caller pass `p-4` and actually win,
					  where `` `p-2 ${className}` `` emits both and leaves the winner to
					  whichever CSS rule sorts last. That is invisible until someone
					  tries to override a default and cannot. Interpolation also drops
					  the falsy handling - `` `space-y-4 ${className}` `` renders the
					  literal string "undefined" as a class when the prop is omitted.
					*/
					selector:
						'JSXAttribute[name.name="className"] > JSXExpressionContainer > TemplateLiteral[expressions.length>0]',
					message:
						'Build className with cn() rather than a template literal: cn() merges conflicting Tailwind classes so a caller can override a default, and drops falsy values instead of rendering "undefined" as a class.'
				},
				{
					/*
					  Interpolation moved inside `cn()`.

					  `cn('p-2', className)` and `` cn(`p-2 ${className}`) `` are not the
					  same call: the first hands clsx two arguments and it drops the
					  falsy one, the second hands it a single pre-joined string and
					  clsx has nothing left to drop - so an undefined prop still lands
					  in the markup as the class `undefined`. tailwind-merge cannot
					  resolve a conflict it can no longer see either. Pass the parts as
					  separate arguments.
					*/
					selector:
						'CallExpression[callee.name="cn"] > TemplateLiteral[expressions.length>0]',
					message:
						'Pass the parts to cn() as separate arguments rather than pre-joining them in a template literal: cn() can only drop falsy values and merge conflicts it can see as distinct arguments.'
				},
				{
					selector:
						'JSXAttribute[name.name="className"] > JSXExpressionContainer > BinaryExpression[operator="+"]',
					message:
						'Build className with cn() rather than string concatenation: cn() merges conflicting Tailwind classes so a caller can override a default, and drops falsy values.'
				},
				{
					/*
					  A z-index outside the named scale.

					  The tiers live in `globals.css` as `--z-index-*` and compile to
					  `z-page-chrome`, `z-nav`, `z-overlay`, `z-above-nav`, `z-tooltip`,
					  `z-overlay-raised` and `z-select`, each with a comment saying what
					  belongs there.

					  The line sits at 50 because 50 is where the app's chrome starts:
					  the site nav and Radix's portal layer both live there, in the root
					  stacking context, so any new number at or above it is competing
					  with them and needs a name. That is not hypothetical. The nav and
					  the route loading bar were both fixed to the top of the viewport
					  at 50, nothing recorded that they overlapped, and DOM order quietly
					  decided the loading bar painted underneath the header.

					  Below 50 is left alone on purpose. Ordering siblings inside one
					  component's own stacking context is local, and a plain z-10 says
					  that more honestly than a tier name would.

					  Every escape hatch is rejected whatever its value, because an
					  escape hatch is exactly how 45, 70, 100 and 120 each arrived
					  without anyone choosing them together. Tailwind v4 spells one
					  three ways and the rule has to know all three: the bracket, the
					  `z-(--custom-property)` shorthand this codebase already uses
					  freely for Radix's popper variables, and a leading `!`, which is
					  the worst of them because it makes a stacking conflict harder to
					  unpick rather than easier.

					  Two forms are deliberately not matched, rather than overlooked.
					  A negative z-index paints behind its stacking context and so
					  cannot compete with the chrome this rule protects. And a value
					  assembled by concatenation, `'z-' + n`, would need constant
					  folding to see; the sibling `cn()` rules have the same limit, and
					  `eslint-house-rules.spec.ts` pins both so the gap stays a decision
					  rather than a surprise.
					*/
					selector:
						'Literal[value=/(^|[\\s:\'"])!?z-(\\[|\\(|[5-9][0-9]|[1-9][0-9]{2,})/]',
					message:
						'z-index outside the named scale. Use a tier from globals.css (z-page-chrome, z-nav, z-overlay, z-above-nav, z-tooltip, z-overlay-raised, z-select), or stay below 50 if this is ordering siblings inside one component. Anything at or above 50 shares the root stacking context with the site nav and Radix overlays, so it needs a name rather than a number.'
				},
				{
					/*
					  The same value written in a backtick string.

					  The two `cn()` rules above only reach a template literal used
					  directly as a className or passed to `cn()`, so a class string
					  parked in a `const` or in a lookup table - which is exactly the
					  shape `PUBLISHER_LAYER` has - would slip past both of them and
					  past the `Literal` selector, which does not match template nodes.
					*/
					selector:
						'TemplateElement[value.raw=/(^|[\\s:\'"])!?z-(\\[|\\(|[5-9][0-9]|[1-9][0-9]{2,})/]',
					message:
						'z-index outside the named scale, written as a template literal. Use a tier from globals.css (z-page-chrome, z-nav, z-overlay, z-above-nav, z-tooltip, z-overlay-raised, z-select), or stay below 50 if this is ordering siblings inside one component.'
				},
				{
					/*
					  An SVG pasted into a feature component.

					  Icons belong in `shared/components/src/assets/icons` as named
					  components, which is what makes them reusable, themable through
					  `currentColor`, and countable - the footer and the YouTube
					  placeholder shipped byte-identical copies of the same YouTube
					  mark, and nothing could see it while both were inline.

					  A component whose whole purpose is drawing a graphic - a ring
					  chart, a background pattern, the loading spinner - is not an icon
					  and is a legitimate exception. Disable this rule on that line with
					  a comment saying which it is.
					*/
					selector: 'JSXOpeningElement[name.name="svg"]',
					message:
						'Inline SVG. Extract it to shared/components/src/assets/icons as a named component and import it. If this component exists to draw a graphic rather than an icon, disable this rule on the line with a comment saying so.'
				}
			]
		}
	},
	{
		// A project's manifest has to list what its source actually imports, and
		// name the version the workspace installs. Nothing else enforces that:
		// pnpm resolves an undeclared import by walking up to the root
		// node_modules, so a manifest can be wrong for years and still build.
		// This rule is also catalog-aware: it reports a hardcoded range when the
		// catalog already owns that package, and offers `catalog:` as the fix.
		files: ['**/package.json'],
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			// Leading slash anchors this to the repo root: the workspace's own
			// manifest is not a project. Without it, flat config treats the
			// pattern like a gitignore entry and skips every package.json.
			'/package.json'
		],
		plugins: { '@nx': nx },
		languageOptions: { parser: jsoncParser },
		rules: {
			'@nx/dependency-checks': ['error', dependencyCheckOptions]
		}
	},
	{
		// The viewer bundles these instead of externalizing them, so a consumer
		// installs nothing for them. @shared/* are private workspace libraries
		// that could not be installed even if they were declared.
		files: ['packages/viewer/package.json'],
		rules: {
			'@nx/dependency-checks': [
				'error',
				{
					...dependencyCheckOptions,
					ignoredDependencies: [
						'@vctrl/core',
						'@shared/components',
						'@shared/utils'
					]
				}
			]
		}
	},
	{
		// @vctrl/embed imports only types from @vctrl/viewer, and vite-plugin-dts
		// inlines them into the emitted declarations. A consumer of the SDK needs
		// nothing from the viewer at runtime or at type-check time, so declaring
		// it as a dependency would pull three and the whole renderer into every
		// install of a package whose point is to be framework-agnostic.
		files: ['packages/embed/package.json'],
		rules: {
			'@nx/dependency-checks': [
				'error',
				{
					...dependencyCheckOptions,
					ignoredDependencies: ['@vctrl/viewer']
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
