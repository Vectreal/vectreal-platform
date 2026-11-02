/**
 * An article revised before a future `publishedAt` must not tell the sitemap
 * it changed before it went live. No real article is dated that way, so the
 * manifest hands the loader one that is.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../app/lib/news/news-manifest.server', () => ({
	getNewsArticles: () => [
		{
			slug: 'written-ahead',
			publishedAt: '2026-11-03T09:00',
			updatedAt: '2026-10-28',
			draft: false
		}
	]
}))

describe('sitemap.xml', () => {
	it('dates an article written ahead by when it went live', async () => {
		vi.stubEnv('APPLICATION_URL', 'https://vectreal.com')
		const { loader } = await import('../app/routes/sitemap[.]xml')
		const xml = await (await loader()).text()
		const entry = xml.slice(xml.indexOf('/news-room/written-ahead'))
		expect(entry.slice(0, entry.indexOf('</url>'))).toContain(
			'<lastmod>2026-11-03</lastmod>'
		)
		vi.unstubAllEnvs()
	})
})
