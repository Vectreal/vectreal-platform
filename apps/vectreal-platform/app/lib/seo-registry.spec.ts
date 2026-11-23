import { describe, expect, it } from 'vitest'

import {
	buildAuthorPersonJsonLd,
	buildNewsArticleJsonLd,
	buildSiteStructuredData
} from './seo-registry'

describe('article author structured data', () => {
	/*
	  The Article node names its author only by @id, and the Person node carries
	  the details, so the two ids have to come out of one spelling, and that
	  spelling is the newsroom's `normalizeSlug`. The hand-written slugifier it
	  replaced kept the leading, trailing and doubled dashes a name with stray
	  spaces and punctuation produces.
	*/
	it.each(['Moritz Becker', '  Ana  María O’Neil ', 'Vectreal Team'])(
		'links the article to the person for %j',
		(name) => {
			const article = buildNewsArticleJsonLd({
				title: 't',
				description: 'd',
				canonicalPath: '/news/x',
				publishedAt: '2026-10-20',
				authorName: name
			})
			const person = buildAuthorPersonJsonLd({ name })

			expect(article.author['@id']).toBe(person['@id'])
			expect(person['@id']).toMatch(/#author-[a-z0-9]+(-[a-z0-9]+)*$/)
		}
	)
})

describe('plan offers in structured data', () => {
	/*
	  The Free offer said USD while the Stripe account sells in euros, the same
	  stale currency that put "$0" on the pricing page's Free card.
	*/
	it('prices the free plan in the currency the plans are sold in', () => {
		const webApp = buildSiteStructuredData().find(
			(node) => node['@type'] === 'WebApplication'
		) as { offers: { name: string; priceCurrency?: string }[] }

		expect(
			webApp.offers.find((offer) => offer.name === 'Free')?.priceCurrency
		).toBe('EUR')
	})
})
