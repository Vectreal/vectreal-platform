import { defineConfig } from 'vite'

import {
	manifestExternals,
	publishedDeclarations
} from '../../vite.library.mts'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/sdk',
	resolve: { tsconfigPaths: true },
	plugins: [
		publishedDeclarations(import.meta.dirname),
		manifestExternals(import.meta.dirname)
	],
	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		lib: {
			entry: 'src/index.ts',
			name: '@vctrl/sdk',
			// ES modules only, as @vctrl/core: Node.js 20.19, 22.12 and later
			// `require()` them too.
			formats: ['es'],
			fileName: () => 'index.js'
		}
	}
})
