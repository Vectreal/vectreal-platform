/// <reference types='vitest' />
import path from 'path'

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: __dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/viewer',
	plugins: [
		react(),
		tailwindcss(),
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
			name: '@vctrl/viewer',
			fileName: 'index',
			// Don't forget to update your package.json as well.
			formats: ['es', 'cjs']
		},
		rollupOptions: {
			// External packages that should not be bundled into the library.
			external: [
				'react',
				'react-dom',
				'three',
				'@react-three/fiber',
				'@react-three/drei',
				'@react-three/postprocessing',
				'postprocessing'
			]
		}
	}
})
