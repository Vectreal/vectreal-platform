import * as path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import { manifestExternals } from '../../vite.library.mts'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/hooks',

	resolve: { tsconfigPaths: true },
	plugins: [
		react(),
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
				'use-load-model': path.resolve(
					import.meta.dirname,
					'src/use-load-model/index.ts'
				),
				'use-optimize-model': path.resolve(
					import.meta.dirname,
					'src/use-optimize-model/index.ts'
				),
				'use-export-model': path.resolve(
					import.meta.dirname,
					'src/use-export-model/index.ts'
				)
			},
			name: '@vctrl/hooks',
			// ES modules only: Node.js 20.19, 22.12 and later `require()` them too,
			// so a CommonJS copy would only add a second instance of each module.
			formats: ['es'],
			fileName: (_format, entry) => `${entry}.js`
		}
	}
})
