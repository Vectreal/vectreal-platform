import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Minimal consumer build config. Mirrors how an integration site would bundle
// @vctrl/viewer: a plain Vite + React app with no awareness of the monorepo.
export default defineConfig({
	plugins: [react()],
	build: {
		// Fail loudly on any unresolved import from the published package so
		// packaging regressions (missing deps, bad externals) surface at build.
		chunkSizeWarningLimit: 5000
	}
})
