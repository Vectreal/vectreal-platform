import { describe, expect, it } from 'vitest'

import { getArticleMarkdown, getDocMarkdown } from './page-markdown.server'
import { publishedLimit } from '../../constants/product-copy'
import { docsPages } from '../docs/docs-manifest'
import { getNewsArticles } from '../news/news-manifest.server'

/*
  Every real page through the real plugin. This is the gate a new MDX
  component or expression trips: the transform throws on anything it has no
  markdown form for, and importing this module evaluates every twin.
*/
// A link or image target that only resolves on vectreal.com itself.
const ROOT_RELATIVE_URL = /\]\(\/(?!\/)/

describe('markdown twins', () => {
	it.each(docsPages.map((page) => [page.slug]))(
		'docs page %s has a twin',
		(slug) => {
			const markdown = getDocMarkdown(slug)
			// Led by its h1, so the ESM imports above it in the source are gone.
			expect(markdown).toMatch(/^# \S/)
			expect(markdown).not.toMatch(/VCTRLEXPR|\{\/\*/)
			expect(markdown).not.toMatch(ROOT_RELATIVE_URL)
		}
	)

	const published = getNewsArticles().filter((article) => !article.draft)

	it.each(published.map((article) => [article.slug, article.title]))(
		'article %s has a twin led by its title',
		(slug, title) => {
			const markdown = getArticleMarkdown(slug)
			expect(markdown?.startsWith(`# ${title}\n`)).toBe(true)
			// Frontmatter is the manifest's to render; none of it leaks into the body.
			expect(markdown).not.toMatch(/VCTRLEXPR|^slug: /m)
			expect(markdown).not.toMatch(ROOT_RELATIVE_URL)
		}
	)

	it('states plan limits from the function the page renders with', () => {
		expect(getDocMarkdown('guides/upload')).toContain(
			`maximum scene size: ${publishedLimit('free', 'storage_bytes_per_scene')} on Free`
		)
	})

	it('turns an example scene into a link to the publisher', () => {
		expect(getDocMarkdown('getting-started')).toContain(
			'(https://vectreal.com/publisher?example=camera-shadows)'
		)
	})

	it('makes root-relative links and images absolute', () => {
		expect(getDocMarkdown('guides/upload')).toContain(
			'(https://vectreal.com/docs/guides/optimize)'
		)
		expect(getArticleMarkdown('api-keys-101')).toContain(
			'(https://vectreal.com/media/images/newsroom/04/'
		)
	})

	it('keeps every video as a link carrying its description', () => {
		expect(getArticleMarkdown('the-vectreal-publisher-walkthrough')).toMatch(
			/\[Video: [^\]]{20,}\]\(https:\/\/vectreal\.com\/media\//
		)
	})

	it('keeps code fences verbatim', () => {
		expect(getDocMarkdown('packages/viewer')).toMatch(
			/```tsx[\s\S]*export default function App\(\)/
		)
	})

	it('answers null for a page that does not exist', () => {
		expect(getDocMarkdown('no/such/page')).toBeNull()
		expect(getArticleMarkdown('no-such-article')).toBeNull()
	})
})
