import { fileURLToPath } from 'node:url'

import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import type { Root, RootContent } from 'mdast'

const COMPONENT_FILE = fileURLToPath(
	new URL('../../components/ai-handoff/ai-handoff-menu.tsx', import.meta.url)
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
		`import { DocPageActions } from ${JSON.stringify(COMPONENT_FILE)}\n\n<DocPageActions />`
	).children as RootContent[]

/**
 * Puts the docs page's Ask AI row at the end of its introduction: before the
 * first `---` or `##`, whichever comes first.
 *
 * The row lives inside the content on narrow screens, where there is no
 * contents rail to hold it, and the layout cannot reach inside an MDX route to
 * place it there. Injected at compile time rather than portalled in after
 * hydration, so the server HTML already has it and nothing below it jumps.
 * Docs pages only; the newsroom has its own rail.
 */
export function remarkDocPageActions() {
	return (tree: Root, file: { path: string }) => {
		if (!toPosix(file.path).startsWith(DOCS_DIRECTORY)) return

		const introEnd = tree.children.findIndex(
			(node) =>
				node.type === 'thematicBreak' ||
				(node.type === 'heading' && node.depth >= 2)
		)
		if (introEnd === -1) return

		const [importNode, element] = structuredClone(INJECTED)
		tree.children.splice(introEnd, 0, element)
		tree.children.unshift(importNode)
	}
}
