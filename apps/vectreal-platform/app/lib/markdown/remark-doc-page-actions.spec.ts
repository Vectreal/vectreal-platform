import { fileURLToPath } from 'node:url'

import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { remarkDocPageActions } from './remark-doc-page-actions'

import type { Root, RootContent } from 'mdast'

const DOCS_PAGE = fileURLToPath(
	new URL('../../routes/docs/guides/example.mdx', import.meta.url)
)
const NEWSROOM_PAGE = fileURLToPath(
	new URL('../../routes/news-room-page/articles/example.mdx', import.meta.url)
)

const transform = (source: string, path = DOCS_PAGE) => {
	const tree = unified().use(remarkParse).use(remarkMdx).parse(source) as Root
	remarkDocPageActions()(tree, { path })
	return tree
}

/** A node's shape, read the way the layout sees it: element names, otherwise node types and heading depths. */
const shape = (node: RootContent): string =>
	node.type === 'mdxJsxFlowElement'
		? (node.name ?? 'fragment')
		: node.type === 'heading'
			? `h${node.depth}`
			: node.type

const children = (node: RootContent | undefined) =>
	node && 'children' in node ? (node.children as RootContent[]).map(shape) : []

describe('remarkDocPageActions', () => {
	it("sets the title and the paragraphs under it as the page's head, closed by the Ask AI row", () => {
		const tree = transform(
			[
				"import { Thing } from './thing'",
				'',
				'# Title',
				'',
				'What the page is for.',
				'',
				'A second line of introduction.',
				'',
				'---',
				'',
				'## First section',
				'',
				'Body text.'
			].join('\n')
		)

		expect(tree.children.map(shape)).toEqual([
			'mdxjsEsm',
			'mdxjsEsm',
			'DocPageHead',
			'DocPageBody'
		])
		expect(children(tree.children[2])).toEqual([
			'h1',
			'paragraph',
			'paragraph',
			'DocPageActions'
		])
		// The `---` that closed the introduction gives way to the frame's rule.
		expect(children(tree.children[3])).toEqual(['h2', 'paragraph'])
	})

	it('opens the body on whatever in the introduction is not a paragraph', () => {
		const tree = transform(
			[
				'# Viewer',
				'',
				'A component.',
				'',
				// Written over lines, as viewer.mdx writes its demo, so it is a block rather than inline JSX.
				'<figure>',
				'  demo',
				'</figure>',
				'',
				'---',
				'',
				'## Install'
			].join('\n')
		)

		expect(children(tree.children[1])).toEqual([
			'h1',
			'paragraph',
			'DocPageActions'
		])
		expect(children(tree.children[2])).toEqual([
			'figure',
			'thematicBreak',
			'h2'
		])
	})

	it('gives a page that does not open on a title no head, and opens its body on the Ask AI row', () => {
		const tree = transform(['Text first.', '', '## Section'].join('\n'))

		expect(tree.children.map(shape)).toEqual(['mdxjsEsm', 'DocPageBody'])
		expect(children(tree.children[1])).toEqual([
			'DocPageActions',
			'paragraph',
			'h2'
		])
	})

	it('leaves a page outside the docs as it is', () => {
		const tree = transform('# Article\n\nText.', NEWSROOM_PAGE)

		expect(tree.children.map(shape)).toEqual(['h1', 'paragraph'])
	})
})
