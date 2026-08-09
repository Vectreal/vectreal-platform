import { describe, expect, it } from 'vitest'

import { getNewsArticles } from './news-manifest'

import type { NewsArticle } from './news-manifest'

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
		// The loader strips the MDX Component and serializes the rest, so an
		// explicit `undefined` would survive into the payload as a null. The
		// conditional spread in the mapping keeps absent fields absent.
		const withoutOverrides = getNewsArticles().filter(
			(article) => article.heroSeed === undefined
		)

		expect(withoutOverrides.length).toBeGreaterThan(0)

		for (const article of withoutOverrides) {
			expect('heroSeed' in article).toBe(false)
		}
	})
})
