import { readFileSync } from 'node:fs'
import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const workspaceRoot = path.resolve(import.meta.dirname, '..')

/**
 * Workspace aliases, derived from tsconfig.base.json.
 *
 * Every other project resolves these through Vite's native
 * `resolve.tsconfigPaths`, which matches each importer against the tsconfig
 * nearest to it. Storybook is the exception: it compiles stories that live
 * inside *other* projects, and those projects' root tsconfigs are
 * solution-style (`"include": []` plus `references`), so the lookup finds
 * nothing declaring `paths` and the cross-project imports fail to resolve.
 *
 * Reading the base config keeps this derived from the one source of truth
 * rather than restating the alias table here.
 */
function workspaceAliases() {
	const base = JSON.parse(
		readFileSync(path.join(workspaceRoot, 'tsconfig.base.json'), 'utf8')
	) as { compilerOptions: { paths: Record<string, string[]> } }

	const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

	return Object.entries(base.compilerOptions.paths).map(
		([pattern, [target]]) => {
			const wildcard = pattern.endsWith('/*')

			return {
				find: new RegExp(
					wildcard ? `^${escape(pattern.slice(0, -2))}/(.*)$` : `^${escape(pattern)}$`
				),
				replacement: wildcard
					? path.join(workspaceRoot, target.slice(0, -2), '$1')
					: path.join(workspaceRoot, target)
			}
		}
	)
}

/**
 * Vite config for the workspace Storybook.
 *
 * Source projects build as libraries with `vite-plugin-dts`, which is the wrong
 * shape for a Storybook. This carries only what the stories need: React, the
 * workspace path aliases so stories can import across projects, and Tailwind,
 * since the stylesheets are what is actually under test here.
 */
export default defineConfig(() => ({
	root: import.meta.dirname,
	cacheDir: '../node_modules/.vite/storybook',
	resolve: { alias: workspaceAliases() },
	plugins: [react(), tailwindcss()]
}))
