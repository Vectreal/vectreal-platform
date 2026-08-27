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
			entry: {
				index: path.resolve(import.meta.dirname, 'src/index.ts'),
				// Dependency-free, so a consumer that only needs the hotspot list
				// rules does not pull React, three and drei in behind them.
				hotspots: path.resolve(import.meta.dirname, 'src/hotspots.ts')
			},
			name: '@vctrl/viewer',
			// Spelled out rather than taking the default, which appends the format
			// to every name: `index.js` and `index.cjs` are what `exports` already
			// points at, and renaming them would break every installed consumer.
			fileName: (format, entry) => `${entry}.${format === 'es' ? 'js' : 'cjs'}`,
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
