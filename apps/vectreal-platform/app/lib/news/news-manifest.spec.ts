import { formatNewsDate } from './news-manifest'

describe('formatNewsDate', () => {
	it('spells a frontmatter date the way the rest of the site does', () => {
		expect(formatNewsDate('2026-10-02T12:00:00Z')).toBe('Oct 2, 2026')
	})

	it('passes an unparseable date through untouched', () => {
		expect(formatNewsDate('soon')).toBe('soon')
	})
})
