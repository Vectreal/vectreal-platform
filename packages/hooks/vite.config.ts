/// <reference types='vitest' />
import * as path from 'path'

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: __dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/hooks',

	plugins: [
		react(),
		nxViteTsPaths(),
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(__dirname, 'tsconfig.lib.json')
		})
	],

	// Uncomment this if you are using workers.
	// worker: {
	//  plugins: [ nxViteTsPaths() ],
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
				index: path.resolve(__dirname, 'src/index.ts'),
				'use-load-model': path.resolve(
					__dirname,
					'src/use-load-model/index.ts'
				),
				'use-optimize-model': path.resolve(
					__dirname,
					'src/use-optimize-model/index.ts'
				),
				'use-export-model': path.resolve(
					__dirname,
					'src/use-export-model/index.ts'
				)
			},
			name: '@vctrl/hooks',
			formats: ['es', 'cjs'],
			fileName: (format, entry) => `${entry}.${format}.js`
		},

		rollupOptions: {
			// External packages that should not be bundled into your library.
			external: [
				'react',
				'react-dom',
				'three',
				'react/jsx-runtime',
				'file-saver',
				'jszip',
				'@gltf-transform/core',
				'@gltf-transform/functions',
				'@gltf-transform/extensions'
			],
			output: {
				globals: {
					react: 'React',
					'react-dom': 'ReactDOM',
					three: 'THREE'
				}
			}
		}
	}
})
