/// <reference types='vitest' />
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig(() => ({
	root: __dirname,
	cacheDir: '../../node_modules/.vite/apps/vectreal-platform',
	server: {
		port: 4200,
		host: 'localhost'
	},
	preview: {
		port: 4300,
		host: 'localhost'
	},
	plugins: [
		tailwindcss(),
		!process.env.VITEST && reactRouter(),
		nxViteTsPaths(),
		nxCopyAssetsPlugin(['*.md'])
	],
	// worker: {
	//  plugins: [ nxViteTsPaths() ],
	// },
	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		commonjsOptions: {
			transformMixedEsModules: true
		}
	},
	test: {
		watch: false,
		globals: true,
		environment: 'jsdom',
		include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
		coverage: {
			reportsDirectory: '../../coverage/apps/vectreal-platform',
			provider: 'v8' as const
		}
	}
}))
