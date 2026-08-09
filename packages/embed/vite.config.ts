import * as path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/embed',
	resolve: { tsconfigPaths: true },
	plugins: [
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json')
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
