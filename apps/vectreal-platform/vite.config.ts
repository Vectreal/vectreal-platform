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

import { mdxMarkdownPlugin } from './app/lib/markdown/mdx-to-markdown.ts'
import {
	newsArticleBodiesPlugin,
	newsArticleChunkFileNames
} from './app/lib/news/news-body-chunks.ts'
import { remarkDocPageActions } from './app/lib/markdown/remark-doc-page-actions.ts'

/**
 * Wraps every MDX `<table>` in a focusable horizontal scroll container.
 *
 * Markdown emits a bare `<table>` with nothing to hang `overflow-x` on, and the
 * stylesheet's first answer to that was `display: block` on the table itself.
 * It stopped the page scrolling sideways - `/docs/packages/viewer` has tables
 * needing 2202px inside a 343px column - and it cost every table in the docs
 * and the newsroom its implicit ARIA role, so rows and columns stopped existing
 * for a screen reader. The overflow fix removed the semantics the element was
 * there for.
 *
 * A wrapper gives the scroll container somewhere to live and leaves the table a
 * table. `tabIndex` sits on the wrapper because a scrollable region with no
 * focusable descendant cannot be reached by keyboard at all (WCAG 2.1.1); it is
 * unconditional because whether a given table overflows is a question about the
 * viewport, which this build step cannot answer. `mdx.module.css` selects the
 * wrapper by data attribute, since it is a CSS module and would hash a class
 * name this cannot know.
 *
 * Inline rather than its own module: importing a `.ts` file from `vite.config`
 * without an extension warns under `configLoader: 'native'`, and with one it
 * needs `allowImportingTsExtensions` across the whole app tsconfig.
 */
interface HastNode {
	type: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

const rehypeTableScroll = () => (tree: HastNode) => {
	const wrap = (node: HastNode): void => {
		if (!node.children) return

		node.children = node.children.map((child) => {
			wrap(child)

			if (child.type !== 'element' || child.tagName !== 'table') {
				return child
			}

			return {
				type: 'element',
				tagName: 'div',
				properties: { 'data-table-scroll': '', tabIndex: 0 },
				children: [child]
			}
		})
	}

	wrap(tree)
}

const prettyCodeOptions = {
	/*
	  Two themes, and the plate is ours.

	  A single dark theme with `keepBackground` put an inline `#24292e` on every
	  block, so a code sample was a dark slab on a light page and ignored the
	  elevation ladder entirely - and it silently won over any colour the
	  stylesheet set, which is how plaintext blocks ended up near-black on near
	  black. Shiki now emits `--shiki-light` / `--shiki-dark` per token, the
	  stylesheet picks one, and the surface stays `ds-sunken` in both themes -
	  the same plate the hand-written snippet on the docs index uses.

	  Both halves are the high-contrast variants. The stock GitHub themes are
	  drawn for a pure white or pure black editor, and on the `ds-sunken` plate
	  their weakest tokens measured 3.28:1 light and 4.00:1 dark - both under the
	  4.5:1 floor, and both on comments, which is where a code sample puts the
	  sentence explaining itself.
	*/
	theme: {
		light: 'github-light-high-contrast',
		dark: 'github-dark-high-contrast'
	},
	keepBackground: false,
	/*
	  Bare fences go through shiki too.
	  A ```` ``` ```` with no language was skipped, so it came out without the
	  `tabindex` shiki puts on every block it renders - and a code block that
	  scrolls sideways with no focusable descendant cannot be read by keyboard at
	  all (WCAG 2.1.1). It also missed the `pre[data-theme]` border. Routing them
	  through plaintext fixes both, at the option rather than at a later plugin
	  that would overwrite what shiki already set correctly.
	*/
	defaultLang: { block: 'plaintext' }
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

/**
 * Third-party packages that get a chunk of their own, so a deploy that does
 * not touch them leaves them cached. Nothing else is grouped: the rest is
 * split by which routes import it, so a route downloads what it uses.
 *
 * Rolldown captures a grouped module's static dependencies into the same
 * chunk, in priority order (earlier here is higher). Under the old
 * `manualChunks` function that was one group with no order, so a bucket
 * swallowed whatever it reached first: `vendor-postprocessing` held all of
 * three.js core, and `vendor-shared` (all of `shared/`) held framer-motion,
 * Radix, react-hook-form and vaul, 160 KB gz on every page, `/embed`
 * included. A bucket for the viewer did the same with `shared/` modules, which
 * put three.js on the home page.
 *
 * So: no bucket for app or workspace code, whose dependencies are shared with
 * pages that must not load them, and each package group above everything that
 * imports it. `includeDependenciesRecursively: false` would stop the capture
 * outright, but rolldown refuses it beside React Router's
 * `preserveEntrySignatures: 'exports-only'`.
 */
const VENDOR_CHUNKS = [
	{
		name: 'vendor-react-runtime',
		test: /\/node_modules\/(react|react-dom|react-router)\//
	},
	{ name: 'vendor-supabase', test: /\/node_modules\/@supabase\// },
	// Above everything built on three, or it lands in their chunk.
	{
		name: 'vendor-three-core',
		test: /\/node_modules\/three\/(?!examples\/jsm\/)/
	},
	{
		name: 'vendor-three-examples',
		test: /\/node_modules\/three\/examples\/jsm\//
	},
	{ name: 'vendor-postprocessing', test: /\/node_modules\/postprocessing\// },
	{ name: 'vendor-react-three', test: /\/node_modules\/@react-three\// }
]

export default defineConfig(({ command }) => {
	const reactCompilerEnabled = shouldEnableReactCompiler(command)

	return {
		root: import.meta.dirname,
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
		resolve: { tsconfigPaths: true },
		/*
		  `future.unstable_optimizeDeps` hands the dev dependency scan every
		  route module, but workers are started with `new Worker(new URL(...))`,
		  which the scan does not follow. A dependency only a worker imports was
		  then found on first use, and Vite answered with a full page reload.
		  React Router's entries are merged with these, not replaced.
		*/
		optimizeDeps: { entries: ['app/workers/*.worker.ts'] },
		plugins: [
			tailwindcss(),
			// Before `mdx()`: it serves `*.mdx?markdown` the MDX plugin would claim.
			mdxMarkdownPlugin(),
			newsArticleBodiesPlugin(),
			mdx({
				format: 'mdx',
				remarkPlugins: [
					remarkGfm,
					remarkFrontmatter,
					remarkMdxFrontmatter,
					remarkDocPageActions
				],
				rehypePlugins: [
					[rehypePrettyCode, prettyCodeOptions],
					rehypeSlug,
					rehypeTableScroll,
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
					// Article bodies are named by an opaque id, never their file name.
					chunkFileNames: newsArticleChunkFileNames,
					codeSplitting: {
						groups: VENDOR_CHUNKS.map((group, index) => ({
							...group,
							priority: VENDOR_CHUNKS.length - index
						}))
					}
				}
			}
		}
	}
})
