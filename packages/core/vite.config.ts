import * as path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/core',

	plugins: [
		tsconfigPaths(),
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
				'model-loader': path.resolve(import.meta.dirname, 'src/model-loader/index.ts'),
				'model-optimizer': path.resolve(
					import.meta.dirname,
					'src/model-optimizer/index.ts'
				),
				'model-exporter': path.resolve(import.meta.dirname, 'src/model-exporter/index.ts')
			},
			name: '@vctrl/core',
			formats: ['es', 'cjs'],
			fileName: (format, entry) => `${entry}.${format}.js`
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
