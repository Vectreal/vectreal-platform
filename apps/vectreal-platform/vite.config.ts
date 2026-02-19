/// <reference types='vitest' />
import mdx from '@mdx-js/rollup'
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

export default defineConfig(() => {
	const coreDistRoot = __dirname + '/../../dist/packages/core'

	return {
		root: __dirname,
		cacheDir: '../../node_modules/.vite/apps/vectreal-platform',
		resolve: {
			alias: {
				'@vctrl/core/model-loader': `${coreDistRoot}/model-loader.es.js`,
				'@vctrl/core/model-optimizer': `${coreDistRoot}/model-optimizer.es.js`,
				'@vctrl/core/model-exporter': `${coreDistRoot}/model-exporter.es.js`,
				'@vctrl/core': `${coreDistRoot}/index.es.js`
			}
		},
		server: {
			port: 4200,
			host: 'localhost'
		},
		preview: {
			port: 4300,
			host: 'localhost'
		},
		assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr'],
		plugins: [
			tailwindcss(),
			nxViteTsPaths(),
			nxCopyAssetsPlugin(['*.md']),
			mdx({
				format: 'mdx'
			}),
			devtoolsJson({
				projectRoot: __dirname
			}),
			!process.env.VITEST && reactRouter()
		],
		// worker: {
		//  plugins: [ nxViteTsPaths() ],
		// },
		// Removed 'ssr.external' because it's incompatible with Cloudflare Vite plugin
		// Externals are now only handled in rollupOptions.external
		build: {
			emptyOutDir: true,
			reportCompressedSize: true,
			commonjsOptions: {
				transformMixedEsModules: true
			},
			rollupOptions: {
				onwarn(warning, warn) {
					const message =
						typeof warning === 'string' ? warning : (warning.message ?? '')

					if (
						message.includes(
							"Error when using sourcemap for reporting an error: Can't resolve original location of error."
						)
					) {
						return
					}

					if (
						message.includes('is dynamically imported by') &&
						message.includes('but also statically imported by')
					) {
						return
					}

					warn(warning)
				},
				output: {
					manualChunks(id) {
						if (id.includes('/node_modules/three/examples/jsm/')) {
							return 'vendor-three-examples'
						}

						if (id.includes('/node_modules/three/')) {
							return 'vendor-three-core'
						}

						if (id.includes('/node_modules/@react-three/fiber/')) {
							return 'vendor-react-three-fiber'
						}

						if (id.includes('/node_modules/@react-three/drei/')) {
							return 'vendor-react-three-drei'
						}

						if (id.includes('/node_modules/@react-three/')) {
							return 'vendor-react-three'
						}

						if (id.includes('/node_modules/postprocessing/')) {
							return 'vendor-postprocessing'
						}

						if (id.includes('/packages/viewer/')) {
							return 'vendor-vectreal-viewer'
						}
					}
				}
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
	}
})
