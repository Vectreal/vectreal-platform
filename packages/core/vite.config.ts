/// <reference types='vitest' />
import * as path from 'path'

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: __dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/core',

	plugins: [
		nxViteTsPaths(),
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(__dirname, 'tsconfig.lib.json')
		})
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		lib: {
			entry: {
				index: path.resolve(__dirname, 'src/index.ts'),
				'model-loader': path.resolve(__dirname, 'src/model-loader/index.ts'),
				'model-optimizer': path.resolve(
					__dirname,
					'src/model-optimizer/index.ts'
				),
				'model-exporter': path.resolve(__dirname, 'src/model-exporter/index.ts')
			},
			name: '@vctrl/core',
			formats: ['es', 'cjs'],
			fileName: (format, entry) => `${entry}.${format}.js`
		},

		rollupOptions: {
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
