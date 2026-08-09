import * as path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/hooks',

	plugins: [
		react(),
		tsconfigPaths(),
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json')
		})
	],

	// Uncomment this if you are using workers.
	// worker: {
	//  plugins: [ tsconfigPaths() ],
	// },

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		// commonjsOptions: {
		// 	transformMixedEsModules: true
		// },
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
			formats: ['es', 'cjs'],
			fileName: (format, entry) => `${entry}.${format}.js`
		},

		rolldownOptions: {
			// External packages that should not be bundled into your library.
			// @vctrl/core (and its subpaths) is externalized so consumers share a
			// single published copy instead of bundling it (which also pulled core's
			// node-only deps like sharp into this browser package).
			external: [
				'react',
				'react-dom',
				'three',
				'react/jsx-runtime',
				'file-saver',
				'jszip',
				/^@vctrl\/core(\/.*)?$/
			],
			output: {
				globals: {
					react: 'React',
					'react-dom': 'ReactDOM'
				}
			}
		}
	}
})
