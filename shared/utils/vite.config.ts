import * as path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig(() => ({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/shared/utils',
	resolve: { tsconfigPaths: true },
	plugins: [
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json')
		})
	],
	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		outDir: '../../build/shared/utils',
		emptyOutDir: true,
		reportCompressedSize: true,
		commonjsOptions: {
			transformMixedEsModules: true
		},
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: 'src/index.ts',
			name: 'utils',
			fileName: 'index',
			// Change this to the formats you want to support.
			// Don't forget to update your package.json as well.
			formats: ['es' as const]
		},
		rolldownOptions: {
			// External packages that should not be bundled into your library.
			external: []
		}
	}
}))
