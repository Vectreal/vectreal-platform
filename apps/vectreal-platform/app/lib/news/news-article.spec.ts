import { formatNewsDate, pinnedFirst } from './news-article'

describe('formatNewsDate', () => {
	it('spells a frontmatter date the way the rest of the site does', () => {
		expect(formatNewsDate('2026-10-02T12:00:00Z')).toBe('Oct 2, 2026')
	})

	it('passes an unparseable date through untouched', () => {
		expect(formatNewsDate('soon')).toBe('soon')
	})
})

describe('pinnedFirst', () => {
	it('lifts pinned articles above the rest, keeping each group in order', () => {
		const articles = [
			{ slug: 'newest', pinned: false },
			{ slug: 'pinned-newer', pinned: true },
			{ slug: 'middle', pinned: false },
			{ slug: 'pinned-older', pinned: true }
		]
		expect(pinnedFirst(articles).map((article) => article.slug)).toEqual([
			'pinned-newer',
			'pinned-older',
			'newest',
			'middle'
		])
	})
})
