import { describe, expect, it } from 'vitest'

import { loader } from './news-room-page'
import { getNewsArticles } from '../../lib/news/news-manifest.server'

import type { Route } from './+types/news-room-page'

const listing = async () => {
	const result = await loader({
		request: new Request('https://vectreal.com/news-room')
	} as Route.LoaderArgs)
	return result.data
}

/* Pinned by their frontmatter on 10 Nov 2026, newest first. */
const PINNED = [
	'3d-product-model-cost',
	'how-to-get-a-3d-model-of-your-product'
]

describe('newsroom listing', () => {
	it('lists the pinned articles first, newest pinned on top', async () => {
		const { articles } = await listing()
		expect(articles.slice(0, PINNED.length).map((a) => a.slug)).toEqual(PINNED)
	})

	it('keeps "Read the latest" on the newest article, pinned or not', async () => {
		const { latestSlug } = await listing()
		expect(latestSlug).toBe(getNewsArticles()[0]?.slug)
	})
})
