import { describe, expect, it } from 'vitest'

import { buildAuthorPersonJsonLd, buildNewsArticleJsonLd } from './seo-registry'

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
