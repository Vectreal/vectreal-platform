import { transformAsync } from '@babel/core'
import mdx from '@mdx-js/rollup'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig, type PluginOption, type Rolldown } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

const prettyCodeOptions = {
	theme: 'github-dark',
	keepBackground: true
}

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
				// Babel 8 types the map's array fields as readonly, which Vite's
				// `SourceMapInput` rejects. The runtime shape is identical.
				map: result.map as Rolldown.SourceMapInput | null
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
		root: import.meta.dirname,
		cacheDir: '../../node_modules/.vite/apps/vectreal-platform',

		server: {
			port: 4210,
			host: "localhost",
			// Allow Supabase Docker containers to call back via host.docker.internal
			allowedHosts: ['host.docker.internal']
		},
		preview: {
			port: 4300,
			host: 'localhost'
		},
		assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr'],
		resolve: { tsconfigPaths: true },
		plugins: [
			tailwindcss(),
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
				projectRoot: import.meta.dirname
			}),
			!process.env.VITEST && reactRouter(),
			reactCompilerPlugin(reactCompilerEnabled)
		],
		// Removed 'ssr.external' because it's incompatible with Cloudflare Vite plugin
		// Externals are now only handled in rolldownOptions.external
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
							/*
							  The hotspot list rules are the one part of the viewer a
							  surface can want without the viewer.

							  `@vctrl/viewer/hotspots` exists so the publisher's sidebar
							  can number sequence steps the same way the renderer does
							  without importing React, three and drei behind it. That
							  buys nothing here unless this predicate agrees: it buckets
							  by path, so a dependency-free module under `packages/viewer`
							  still lands in a chunk that statically imports
							  `vendor-react-three`, which imports `vendor-postprocessing`.
							  Left in, one `resolveHotspotMarkers` call in a compose panel
							  put the 62KB viewer chunk into the shared `components-*`
							  chunk, which the marketing home page imports statically.

							  Measured on the emitted graph, not estimated. Note what it
							  does *not* fix: three, R3F and postprocessing are eager on
							  `/` regardless, through `components-*` →
							  `vendor-three-examples` → `vendor-postprocessing`, which
							  `@vctrl/core`'s glTF exporter pulls in. That is a separate
							  and much larger problem, filed on its own.

							  Its own bucket rather than none: the module is imported by
							  the viewer's own barrel too, so leaving it unbucketed lets
							  rollup hoist the shared copy straight back into the chunk
							  this is trying to keep it out of.
							*/
							/*
							  Matched exactly. A looser `includes` would also catch a
							  future `src/hotspots/` directory or a `.tsx` of the same
							  name, and quietly put an R3F-importing module into the
							  bucket the marketing home page imports eagerly.
							*/
							if (
								id.endsWith('/packages/viewer/src/hotspots.ts') ||
								id.endsWith(
									'/packages/viewer/src/components/scene/resolve-hotspot-markers.ts'
								)
							) {
								return 'vendor-vectreal-hotspots'
							}

							return 'vendor-vectreal-viewer'
						}
					}
				}
			}
		}
	}
})
