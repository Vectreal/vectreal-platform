import path from 'path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/viewer',
	resolve: { tsconfigPaths: true },
	plugins: [
		tailwindcss(),
		react(),
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json')
		})
	],

	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		cssCodeSplit: false,
		commonjsOptions: {
			transformMixedEsModules: true
		},

		lib: {
			entry: 'src/index.ts',
			name: '@vctrl/viewer',
			fileName: 'index',
			cssFileName: 'style',
			// Don't forget to update your package.json as well.
			formats: ['es', 'cjs']
		},
		rolldownOptions: {
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
