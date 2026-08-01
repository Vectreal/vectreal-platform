import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Vite config for the workspace Storybook.
 *
 * Source projects build as libraries with `vite-plugin-dts`, which is the wrong
 * shape for a Storybook. This carries only what the stories need: React, the
 * workspace path aliases so stories can import across projects, and Tailwind,
 * since the stylesheets are what is actually under test here.
 */
export default defineConfig(() => ({
	root: __dirname,
	cacheDir: '../node_modules/.vite/storybook',
	plugins: [react(), nxViteTsPaths(), tailwindcss()]
}))
