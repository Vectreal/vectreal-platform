import * as path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import { manifestExternals } from '../../vite.library.mts'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/embed',
	resolve: { tsconfigPaths: true },
	plugins: [
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json')
		}),
		manifestExternals(import.meta.dirname)
	],

	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		lib: {
			entry: 'src/index.ts',
			name: '@vctrl/embed',
			fileName: 'index',
			formats: ['es', 'iife']
		},
		rolldownOptions: {
			output: [
				{
					format: 'es',
					entryFileNames: 'index.js'
				},
				{
					/*
					  The classic `<script>` build: it defines the `VectrealEmbed`
					  global and nothing else. It keeps the `.umd.js` name it had
					  when it was UMD because generated snippets on customer pages
					  load it by that unversioned URL (`EMBED_SDK_CDN_URL`).
					*/
					format: 'iife',
					name: 'VectrealEmbed',
					entryFileNames: 'vectreal-embed.umd.js',
					exports: 'named'
				}
			]
		}
	}
})
