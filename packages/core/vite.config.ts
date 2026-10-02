import * as path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import { manifestExternals } from '../../vite.library.mts'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/core',

	resolve: { tsconfigPaths: true },
	plugins: [
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json')
		}),
		manifestExternals(import.meta.dirname)
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		lib: {
			entry: {
				index: path.resolve(import.meta.dirname, 'src/index.ts'),
				'model-formats': path.resolve(
					import.meta.dirname,
					'src/model-formats/index.ts'
				),
				'model-loader': path.resolve(
					import.meta.dirname,
					'src/model-loader/index.ts'
				),
				'model-optimizer': path.resolve(
					import.meta.dirname,
					'src/model-optimizer/index.ts'
				),
				'model-exporter': path.resolve(
					import.meta.dirname,
					'src/model-exporter/index.ts'
				)
			},
			name: '@vctrl/core',
			// ES modules only: Node.js 20.19, 22.12 and later `require()` them too,
			// so a CommonJS copy would only add a second instance of each module.
			formats: ['es'],
			fileName: (_format, entry) => `${entry}.js`
		}
	}
})
