/**
 * Wraps every MDX `<table>` in a focusable horizontal scroll container.
 *
 * Markdown emits a bare `<table>` with nothing to hang `overflow-x` on, and the
 * stylesheet's first answer to that was `display: block` on the table itself.
 * It worked - `/docs/packages/viewer` has seven tables too wide for a 375px
 * viewport, and the page stopped scrolling sideways - but a table whose
 * `display` is not a table value loses its implicit ARIA role, so every table in
 * the docs and the newsroom stopped exposing rows and columns to a screen
 * reader. The overflow fix cost the semantics the table existed for.
 *
 * A wrapper gives the scroll container somewhere to live and leaves the table a
 * table. `tabIndex` sits on the wrapper because a scrollable region with no
 * focusable descendant cannot be reached by keyboard at all (WCAG 2.1.1), and
 * the data attribute is what the stylesheet selects: `mdx.module.css` is a CSS
 * module, so a class name written here would never match the hashed one there.
 */
interface HastNode {
	type: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

export default function rehypeTableScroll() {
	return (tree: HastNode) => {
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
}
