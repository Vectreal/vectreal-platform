import * as path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/core',

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
			external: [
				'three',
				'file-saver',
				'jszip',
				'sharp',
				'meshoptimizer',
				'@gltf-transform/core',
				'@gltf-transform/functions',
				'@gltf-transform/extensions'
			],
			output: {
				globals: {
					three: 'THREE',
					sharp: 'sharp'
				}
			}
		}
	}
})
