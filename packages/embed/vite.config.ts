import * as path from 'path'

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: __dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/embed',
	plugins: [
		nxViteTsPaths(),
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(__dirname, 'tsconfig.lib.json')
		})
	],

	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		commonjsOptions: {
			transformMixedEsModules: true
		},
		lib: {
			entry: 'src/index.ts',
			name: '@vctrl/embed',
			fileName: 'index',
			formats: ['es', 'cjs']
		},
		rolldownOptions: {
			output: [
				{
					format: 'es',
					entryFileNames: 'index.js'
				},
				{
					format: 'cjs',
					entryFileNames: 'index.cjs'
				},
				{
					format: 'umd',
					name: 'VectrealEmbed',
					entryFileNames: 'vectreal-embed.umd.js',
					exports: 'named'
				}
			]
		}
	}
})
