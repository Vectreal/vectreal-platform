/// <reference types='vitest' />
import { transformAsync } from '@babel/core'
import mdx from '@mdx-js/rollup'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig, type PluginOption } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import { VitePWA } from 'vite-plugin-pwa'

const prettyCodeOptions = {
	theme: 'github-dark',
	keepBackground: true
}

// Public path prefix for Draco decoder files (binary/wasm) served from
// public/draco/. These assets rarely change and benefit from a long-lived cache.
const DRACO_PUBLIC_PATH_PREFIX = '/draco/'

const reactCompilerEnvVar = 'VITE_EXPERIMENTAL_REACT_COMPILER'

const reactCompilerOptions = {
	target: '19',
	panicThreshold: 'none'
} as const

const reactCompilerPlugin = (enabled: boolean): PluginOption => {
	if (!enabled) {
		return false
	}

	return {
		name: 'vectreal-react-compiler',
		enforce: 'pre',
		async transform(code, id) {
			if (id.includes('/node_modules/')) {
				return null
			}

			const [filepath] = id.split('?')

			if (!/\.[jt]sx?$/.test(filepath)) {
				return null
			}

			const result = await transformAsync(code, {
				babelrc: false,
				configFile: false,
				filename: id,
				sourceFileName: filepath,
				sourceMaps: true,
				parserOpts: {
					sourceType: 'module',
					allowAwaitOutsideFunction: true,
					plugins: ['jsx', 'typescript']
				},
				plugins: [['babel-plugin-react-compiler', reactCompilerOptions]]
			})

			if (result === null) {
				return null
			}

			return {
				code: result.code ?? code,
				map: result.map
			}
		}
	}
}

const shouldEnableReactCompiler = (command: 'build' | 'serve') => {
	const explicitValue = process.env[reactCompilerEnvVar]

	if (explicitValue === 'true') {
		return true
	}

	if (explicitValue === 'false') {
		return false
	}

	return command === 'build'
}

export default defineConfig(({ command }) => {
	const reactCompilerEnabled = shouldEnableReactCompiler(command)

	return {
		root: __dirname,
		cacheDir: '../../node_modules/.vite/apps/vectreal-platform',

		server: {
			port: 4200,
			host: 'localhost',
			// Allow Supabase Docker containers to call back via host.docker.internal
			allowedHosts: ['host.docker.internal']
		},
		preview: {
			port: 4300,
			host: 'localhost'
		},
		assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr'],
		plugins: [
			tailwindcss(),
			nxViteTsPaths(),
			mdx({
				format: 'mdx',
				remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter],
				rehypePlugins: [
					[rehypePrettyCode, prettyCodeOptions],
					rehypeSlug,
					[
						rehypeAutolinkHeadings,
						{
							behavior: 'append',
							properties: {
								ariaHidden: 'true',
								tabIndex: -1,
								className: ['heading-anchor']
							},
							content: {
								type: 'text',
								value: '#'
							}
						}
					]
				]
			}),
			devtoolsJson({
				projectRoot: __dirname
			}),
			!process.env.VITEST && reactRouter(),
			reactCompilerPlugin(reactCompilerEnabled),
			VitePWA({
				// New service worker waits for user confirmation before activating.
				registerType: 'prompt',
				// Registration is handled manually via useRegisterSW in pwa-update-banner.tsx.
				injectRegister: false,
				// Use the existing public/site.webmanifest; the plugin won't touch it.
				manifest: false,
				// Dev mode: service worker stays disabled.
				devOptions: {
					enabled: false
				},
				workbox: {
					// Precache compiled JS/CSS bundles, icons, and fonts.
					// HTML navigation responses are intentionally excluded (SSR app).
					globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
					runtimeCaching: [
						// Draco WASM/JS decoder files ship in public/draco/ and
						// are not fingerprinted, so keep cache-first but with a short TTL.
						{
							urlPattern: ({ url }) =>
								url.pathname.startsWith(DRACO_PUBLIC_PATH_PREFIX),
							handler: 'CacheFirst',
							options: {
								cacheName: 'draco-assets',
								expiration: {
									maxEntries: 20,
									maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
								},
								cacheableResponse: { statuses: [0, 200] }
							}
						}
					]
				}
			})
		],
		// worker: {
		//  plugins: [ nxViteTsPaths() ],
		// },
		// Removed 'ssr.external' because it's incompatible with Cloudflare Vite plugin
		// Externals are now only handled in rolldownOptions.external
		ssr: {
			enable: true,
			// posthog-js and @posthog/react must be bundled for SSR to avoid module resolution errors
			noExternal: ['posthog-js', '@posthog/react']
		},
		build: {
			emptyOutDir: true,
			reportCompressedSize: true,
			commonjsOptions: {
				transformMixedEsModules: true
			},
			rolldownOptions: {
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
						if (
							id.includes('/shared/components/') ||
							id.includes('/shared/utils/')
						) {
							return 'vendor-shared'
						}

						if (
							id.includes('/node_modules/react/') ||
							id.includes('/node_modules/react-dom/') ||
							id.includes('/node_modules/react-router/')
						) {
							return 'vendor-react-runtime'
						}

						if (id.includes('/node_modules/@supabase/')) {
							return 'vendor-supabase'
						}

						if (
							id.includes('/node_modules/@radix-ui/') ||
							id.includes('/node_modules/framer-motion/') ||
							id.includes('/node_modules/lucide-react/') ||
							id.includes('/node_modules/sonner/')
						) {
							return 'vendor-ui'
						}

						if (id.includes('/node_modules/three/examples/jsm/')) {
							return 'vendor-three-examples'
						}

						if (id.includes('/node_modules/three/')) {
							return 'vendor-three-core'
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
