/// <reference types='vitest' />
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
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

const prettyCodeOptions = {
	theme: 'github-dark',
	keepBackground: true
}

export default defineConfig(() => {
	return {
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
			!process.env.VITEST && reactRouter()
		],
		// worker: {
		//  plugins: [ nxViteTsPaths() ],
		// },
		// Removed 'ssr.external' because it's incompatible with Cloudflare Vite plugin
		// Externals are now only handled in rollupOptions.external
		ssr: {
			// posthog-js and @posthog/react must be bundled for SSR to avoid module resolution errors
			noExternal: ['posthog-js', '@posthog/react']
		},
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
