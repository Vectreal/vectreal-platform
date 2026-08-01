import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Vite config for the Storybook build only.
 *
 * The library config next door is in lib mode with `vite-plugin-dts`, which
 * emits declarations and bundles to a single entry - neither of which makes
 * sense for a Storybook. This carries just what the stories need: React, the
 * workspace path aliases, and Tailwind, since `globals.css` is what is actually
 * under test here.
 */
export default defineConfig(() => ({
	root: __dirname,
	cacheDir: '../../node_modules/.vite/shared/components-storybook',
	plugins: [react(), nxViteTsPaths(), tailwindcss()]
}))
