import path from 'path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import { manifestExternals, scopedStylesheet } from '../../vite.library.mts'

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
		}),
		manifestExternals(import.meta.dirname),
		// The published stylesheet matches only inside a viewer, so an app's own
		// Tailwind classes keep winning everywhere else on its page.
		scopedStylesheet('style.css', '.vctrl-viewer')
	],

	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		cssCodeSplit: false,
		lib: {
			entry: {
				// The source entry plus the Tailwind utilities a consumer of the
				// bundle cannot generate; see `src/package.css`.
				index: path.resolve(import.meta.dirname, 'src/index.package.ts'),
				// Dependency-free, so a consumer that only needs the hotspot list
				// rules does not pull React, three and drei in behind them.
				hotspots: path.resolve(import.meta.dirname, 'src/hotspots.ts')
			},
			name: '@vctrl/viewer',
			// ES modules only: Node.js 20.19, 22.12 and later `require()` them too,
			// so a CommonJS copy would only add a second instance of each module.
			formats: ['es'],
			fileName: (_format, entry) => `${entry}.js`,
			cssFileName: 'style'
		}
	}
})
