import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

import type { Link, Parent, PhrasingContent, Root, RootContent } from 'mdast'
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import type { Plugin } from 'vite'

/**
 * A page's MDX source as plain markdown, for readers that are not a browser:
 * a pasted chat, a coding agent, `/llms-full.txt`.
 *
 * The values a page computes are not computed here. This module runs inside
 * the Vite config graph, where nothing may import `@vctrl/*` (it resolves to a
 * build directory CI never builds), and `product-copy.ts` does. So a computed
 * value leaves as a token in `markdown` plus the JavaScript that produces it in
 * `expressions`, and the plugin emits a module that evaluates them in the app's
 * own bundle. The twin then states the same number the page does, from the same
 * function, rather than a copy of it.
 *
 * Everything an MDX page can contain that markdown cannot is handled by a
 * closed list. A component or expression this module has not been told about
 * throws, with the file and line, so a new one fails the build instead of
 * disappearing from the twin.
 */
export interface MarkdownTwin {
	/** Markdown with `expressionToken(i)` where `expressions[i]` belongs. */
	markdown: string
	/** JavaScript expressions over `MARKDOWN_TWIN_BINDINGS`, one per token. */
	expressions: string[]
}

/** The names an expression may use; the plugin imports exactly these. */
export const MARKDOWN_TWIN_BINDINGS = {
	publishedLimit: 'app/constants/product-copy.ts',
	publisherExampleHref: 'app/lib/samples/example-scenes.ts',
	SITE_URL: 'app/lib/seo.ts'
} as const

/** Alphanumeric, so no markdown escaping can reach inside it. */
export const expressionToken = (index: number) => `VCTRLEXPR${index}VCTRL`

export const EXPRESSION_TOKEN_PATTERN = /VCTRLEXPR(\d+)VCTRL/g

const PUBLISHED_LIMIT_CALL =
	/^publishedLimit\(\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*\)$/

const COMMENT_ONLY = /^\s*\/\*[\s\S]*\*\/\s*$/

type JsxElement = MdxJsxFlowElement | MdxJsxTextElement

/*
  What each JSX element becomes, HTML elements included: a `<video>` has no
  children, so unwrapping every lowercase element would have deleted all
  seventeen of the newsroom's videos, captions and all, without a word.
*/
const unwrap = (element: JsxElement) => element.children as RootContent[]

const ELEMENTS: Record<
	string,
	(element: JsxElement, context: TwinContext) => RootContent[]
> = {
	figure: unwrap,
	figcaption: unwrap,
	div: unwrap,
	// A clip and its description: the `aria-label` is written to stand in for it.
	video: (element, context) => {
		const label = stringAttribute(element, 'aria-label', context)
		const src = stringAttribute(element, 'src', context) ?? ''
		const link: Link = {
			type: 'link',
			url: absoluteUrl(src, context),
			children: [{ type: 'text', value: `Video: ${label}` }]
		}
		return element.type === 'mdxJsxTextElement'
			? [link]
			: [{ type: 'paragraph', children: [link] }]
	},
	// The live viewer on the viewer package page. Its caption is a sibling
	// `figcaption`, which survives the unwrap.
	DocsScenePreview: () => [],
	ExampleScene: (element, context) => {
		const id = stringAttribute(element, 'id', context)
		const caption = stringAttribute(element, 'caption', context, false)
		const href = `${context.token('SITE_URL')}${context.token(`publisherExampleHref(${JSON.stringify(id)})`)}`
		const link: Link = {
			type: 'link',
			url: href,
			children: [{ type: 'text', value: 'Open the interactive example' }]
		}
		const children: PhrasingContent[] = caption
			? [{ type: 'text', value: `${caption} ` }, link]
			: [link]
		return [{ type: 'paragraph', children }]
	}
}

/**
 * Root-relative URLs resolve against vectreal.com wherever the markdown is
 * pasted. Not `//host` URLs, which are already absolute.
 */
function absoluteUrl(url: string, context: TwinContext): string {
	return url.startsWith('/') && !url.startsWith('//')
		? `${context.token('SITE_URL')}${url}`
		: url
}

interface TwinContext {
	line: (node: { position?: { start: { line: number } } }) => string
	token: (expression: string) => string
}

function stringAttribute(
	element: JsxElement,
	name: string,
	context: TwinContext,
	required = true
): string | undefined {
	const attribute = element.attributes.find(
		(candidate) =>
			candidate.type === 'mdxJsxAttribute' && candidate.name === name
	)
	if (attribute?.type === 'mdxJsxAttribute') {
		if (typeof attribute.value === 'string') return attribute.value
		throw new Error(
			`${context.line(element)}: <${element.name} ${name}> must be a string literal in a markdown twin`
		)
	}
	if (required) {
		throw new Error(
			`${context.line(element)}: <${element.name}> is missing ${name}`
		)
	}
	return undefined
}

export function mdxToMarkdown(source: string, filePath: string): MarkdownTwin {
	const expressions: string[] = []
	const context: TwinContext = {
		line: (node) => `${filePath}:${node.position?.start.line ?? '?'}`,
		token: (expression) => {
			expressions.push(expression)
			return expressionToken(expressions.length - 1)
		}
	}

	const tree = unified()
		.use(remarkParse)
		.use(remarkMdx)
		.use(remarkFrontmatter)
		.use(remarkGfm)
		.parse(source) as Root

	visit(tree, (node: Root | RootContent, index, parent: Parent | undefined) => {
		if (!parent || index === undefined) return

		const replace = (replacement: RootContent[]) => {
			parent.children.splice(index, 1, ...(replacement as never[]))
			// Revisit from the same index: unwrapped children are content too.
			return [SKIP, index] as [typeof SKIP, number]
		}

		switch (node.type) {
			case 'yaml':
			case 'mdxjsEsm':
				return replace([])
			case 'mdxFlowExpression':
			case 'mdxTextExpression': {
				if (COMMENT_ONLY.test(node.value)) return replace([])
				const call = PUBLISHED_LIMIT_CALL.exec(node.value.trim())
				if (!call) {
					throw new Error(
						`${context.line(node)}: expression {${node.value}} has no markdown form; add it to mdx-to-markdown.ts`
					)
				}
				return replace([
					{
						type: 'text',
						value: context.token(
							`publishedLimit(${JSON.stringify(call[1])}, ${JSON.stringify(call[2])})`
						)
					}
				])
			}
			case 'mdxJsxFlowElement':
			case 'mdxJsxTextElement': {
				const name = node.name ?? ''
				const toMarkdown = ELEMENTS[name]
				if (!toMarkdown) {
					throw new Error(
						`${context.line(node)}: <${name || 'fragment'}> has no markdown form; add it to mdx-to-markdown.ts`
					)
				}
				return replace(toMarkdown(node, context))
			}
			case 'link':
			case 'image':
			case 'definition':
				node.url = absoluteUrl(node.url, context)
				return
			default:
				return
		}
	})

	const markdown = unified()
		.use(remarkStringify, { bullet: '-', fences: true, rule: '-' })
		.use(remarkGfm)
		.stringify(tree)

	return { markdown, expressions }
}

/**
 * The ES module the plugin serves for a twin: `markdown` with each token
 * replaced by its evaluated expression, importing the bindings from `appRoot`.
 */
export function markdownTwinModule(
	twin: MarkdownTwin,
	appRoot: string
): string {
	const imports = Object.entries(MARKDOWN_TWIN_BINDINGS)
		.map(
			([name, file]) =>
				`import { ${name} } from ${JSON.stringify(`${appRoot}/${file}`)}`
		)
		.join('\n')

	const parts = twin.markdown.split(EXPRESSION_TOKEN_PATTERN)
	// `split` with a capture group alternates text and captured indices.
	const body = parts
		.map((part, i) =>
			i % 2 === 0
				? JSON.stringify(part)
				: `String(${twin.expressions[Number(part)]})`
		)
		.join(' + ')

	return `${imports}\nexport default ${body}\n`
}

const QUERY = '?markdown'
const VIRTUAL_PREFIX = '\0mdx-markdown:'
const APP_ROOT = fileURLToPath(new URL('../../..', import.meta.url)).replace(
	/\/$/,
	''
)

/**
 * Serves `*.mdx?markdown` as a module whose default export is the page's
 * markdown twin (see `mdxToMarkdown` above).
 *
 * `@mdx-js/rollup` strips the query before it filters, so it would claim
 * `page.mdx?markdown` and hand back the compiled component, which is why a
 * `?raw` import never returns source either. Resolving to a virtual id that no
 * longer ends in `.mdx`, before the MDX plugin sees it, takes the id out of its
 * reach. Registered in `vite.config.ts` and `vitest.config.ts` alike.
 *
 * In this file rather than its own because the config graph has to import it
 * by its `.ts` extension, and a second relative import from here would need
 * one too, which the app tsconfig does not allow.
 */
export function mdxMarkdownPlugin(): Plugin {
	return {
		name: 'vectreal-mdx-markdown',
		enforce: 'pre',
		async resolveId(source, importer) {
			if (!source.endsWith(`.mdx${QUERY}`)) return null
			const resolved = await this.resolve(
				source.slice(0, -QUERY.length),
				importer,
				{
					skipSelf: true
				}
			)
			return resolved ? `${VIRTUAL_PREFIX}${resolved.id}` : null
		},
		async load(id) {
			if (!id.startsWith(VIRTUAL_PREFIX)) return null
			const filePath = id.slice(VIRTUAL_PREFIX.length)
			this.addWatchFile(filePath)
			const source = await readFile(filePath, 'utf8')
			const relativePath = filePath.startsWith(APP_ROOT)
				? `apps/vectreal-platform${filePath.slice(APP_ROOT.length)}`
				: filePath
			return markdownTwinModule(mdxToMarkdown(source, relativePath), APP_ROOT)
		}
	}
}
