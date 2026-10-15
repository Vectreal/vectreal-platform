import { describe, expect, it } from 'vitest'

import { getNewsArticles } from './news-manifest.server'

import type { NewsArticle } from './news-article'

describe('news manifest hero fields', () => {
	it('exposes optional heroSeed and heroImage on every article', () => {
		const articles = getNewsArticles()

		expect(articles.length).toBeGreaterThan(0)

		for (const article of articles) {
			const hero: Pick<NewsArticle, 'heroSeed' | 'heroImage'> = article

			expect(
				hero.heroSeed === undefined || typeof hero.heroSeed === 'number'
			).toBe(true)
			expect(
				hero.heroImage === undefined || typeof hero.heroImage === 'string'
			).toBe(true)
		}
	})

	it('omits the keys entirely rather than setting them undefined', () => {
		// Loaders serialize the article, so an explicit `undefined` would
		// survive into the payload as a null. The conditional spread in the
		// mapping keeps absent fields absent.
		const withoutOverrides = getNewsArticles().filter(
			(article) => article.heroSeed === undefined
		)

		expect(withoutOverrides.length).toBeGreaterThan(0)

		for (const article of withoutOverrides) {
			expect('heroSeed' in article).toBe(false)
		}
	})
})
