import { getArticleBody } from './news-article-body'
import { getNewsArticles } from './news-manifest.server'

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

	it('finds a body for every article it lists', () => {
		// The page renders whatever `getArticleBody` returns for the id the
		// manifest hands it, so an id the two disagree on is an empty article.
		for (const article of getNewsArticles())
			expect(getArticleBody(article.bodyId), article.slug).toBeDefined()
	})
})
