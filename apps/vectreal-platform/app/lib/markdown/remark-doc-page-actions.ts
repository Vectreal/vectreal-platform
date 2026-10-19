import { fileURLToPath } from 'node:url'

import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import type { Root, RootContent } from 'mdast'
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'

const ACTIONS_FILE = fileURLToPath(
	new URL('../../components/ai-handoff/ai-handoff-menu.tsx', import.meta.url)
)
const FRAME_FILE = fileURLToPath(
	new URL('../../components/docs/doc-page-frame.tsx', import.meta.url)
)

// Forward slashes on both sides: Vite hands over `C:/...`, Node answers `C:\...`.
const toPosix = (path: string) => path.replace(/\\/g, '/')

const DOCS_DIRECTORY = toPosix(
	fileURLToPath(new URL('../../routes/docs/', import.meta.url))
)

/*
  Parsed rather than built by hand: MDX compiles an import from the estree that
  remark-mdx attaches, and writing that tree out node by node is how it drifts.
*/
const INJECTED = unified()
	.use(remarkParse)
	.use(remarkMdx)
	.parse(
		[
			`import { DocPageActions } from ${JSON.stringify(ACTIONS_FILE)}`,
			`import { DocPageBody, DocPageHead } from ${JSON.stringify(FRAME_FILE)}`,
			'',
			'<DocPageActions />',
			'',
			'<DocPageHead />',
			'',
			'<DocPageBody />'
		].join('\n')
	).children as RootContent[]

/** Nodes that belong to the module rather than to the page: imports, exports and frontmatter. */
const isModuleNode = (node: RootContent) =>
	node.type === 'mdxjsEsm' || node.type === 'yaml'

/**
 * Splits a docs page into its head and its body, and closes the head with the
 * page's Ask AI row.
 *
 * The head is the `#` title and the paragraphs directly under it: the page's
 * name and what it is for. The layout runs it edge to edge above the docs
 * frame, as every marketing page's head runs above its frame, and sets the
 * body in the frame's middle column. Anything else in the introduction, such
 * as the viewer page's live demo or a quoted note, opens the body instead,
 * where it has the column's measure. A `---` that would open the body is
 * dropped: the frame's rule under the head is that break now. A page that
 * does not open on a `#` title has no head, and its Ask AI row opens the body.
 *
 * Done at compile time because the layout cannot reach inside an MDX route to
 * take its title out, and the MDX files stay as they are written. The Ask AI
 * row lives in the page on narrow screens, where there is no contents rail to
 * hold it; injected here rather than portalled in after hydration, so the
 * server HTML already has it and nothing below it jumps. Docs pages only; the
 * newsroom has its own rail.
 */
export function remarkDocPageActions() {
	return (tree: Root, file: { path: string }) => {
		if (!toPosix(file.path).startsWith(DOCS_DIRECTORY)) return

		const [imports, actions, head, body] = structuredClone(INJECTED) as [
			RootContent,
			MdxJsxFlowElement,
			MdxJsxFlowElement,
			MdxJsxFlowElement
		]
		const module = tree.children.filter(isModuleNode)
		const content = tree.children.filter((node) => !isModuleNode(node))

		const [first] = content
		const titled = first?.type === 'heading' && first.depth === 1
		const headEnd = titled
			? content.findIndex((node, i) => i > 0 && node.type !== 'paragraph')
			: 0
		const split = headEnd === -1 ? content.length : headEnd
		const rest = content.slice(split)
		if (rest[0]?.type === 'thematicBreak') rest.shift()

		if (titled) {
			head.children = [
				...content.slice(0, split),
				actions
			] as MdxJsxFlowElement['children']
			body.children = rest as MdxJsxFlowElement['children']
			tree.children = [imports, ...module, head, body]
		} else {
			body.children = [actions, ...rest] as MdxJsxFlowElement['children']
			tree.children = [imports, ...module, body]
		}
	}
}
