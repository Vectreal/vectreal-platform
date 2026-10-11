import { formatNewsDate, getNewsArticles } from './news-manifest'

describe('formatNewsDate', () => {
	it('spells a frontmatter date the way the rest of the site does', () => {
		expect(formatNewsDate('2026-10-02T12:00:00Z')).toBe('Oct 2, 2026')
	})

	it('passes an unparseable date through untouched', () => {
		expect(formatNewsDate('soon')).toBe('soon')
	})
})

describe('news manifest', () => {
	it('keeps every article file, so invalid frontmatter cannot drop one silently', () => {
		// An article with invalid frontmatter, an unreadable `cta:` among them, is
		// left out with only a dev warning. This is where that becomes a failure.
		const files = Object.keys(
			import.meta.glob('../../routes/news-room-page/articles/*.mdx')
		)

		expect(files.length).toBeGreaterThan(0)
		expect(getNewsArticles()).toHaveLength(files.length)
	})
})
