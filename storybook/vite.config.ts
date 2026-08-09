import path from 'path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

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
	plugins: [
		react(),
		// Stories live in other projects (shared/components, packages/viewer) and
		// those projects' own tsconfigs declare `include: []`, so crawling finds no
		// matcher covering the story files and the workspace aliases fail to
		// resolve. tsconfig.base.json declares the `paths` and has no `include`,
		// so it covers the whole repo.
		tsconfigPaths({
			projects: [path.resolve(import.meta.dirname, '../tsconfig.base.json')]
		}),
		tailwindcss()
	]
}))
