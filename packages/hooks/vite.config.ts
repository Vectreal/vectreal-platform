import * as path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/hooks',

	resolve: { tsconfigPaths: true },
	plugins: [
		react(),
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json')
		})
	],

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
			/*
			  `.cjs` for CommonJS, not `.cjs.js`. The package is `"type": "module"`
			  and Node reads module type from the extension, so a `.js` file is ESM
			  whatever its name says: every `require` entry used to load as ESM and
			  fail. The viewer names its output this way for the same reason.
			*/
			fileName: (format, entry) =>
				format === 'cjs' ? `${entry}.cjs` : `${entry}.${format}.js`
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
				// @vctrl/core externalizes @gltf-transform/core, so bundling a
				// second copy here would give consumers two Document classes and
				// break every instanceof across the two packages.
				/^@gltf-transform\/core(\/.*)?$/,
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
