import { describe, expect, it } from 'vitest'

import { SITE_URL, toCanonicalUrl } from './seo'
import { loader as robotsLoader } from '../routes/robots[.]txt'
import { loader as sitemapLoader } from '../routes/sitemap[.]xml'

/**
 * A page has one address, and every surface that names it has to agree.
 *
 * When they disagreed, the site became unindexable: the sitemap advertised
 * `/docs`, the origin answered that with `301 -> /docs/`, and the page served
 * there carried a canonical pointing back at `/docs`. Google filed the first
 * URL under "Page with redirect" and the second under "Alternate page with
 * proper canonical tag", so neither could ever be indexed. These tests fail if
 * the two forms drift apart again.
 */
describe('toCanonicalUrl', () => {
	it('drops the trailing slash the prerenderer adds', () => {
		expect(toCanonicalUrl('/about/')).toBe(`${SITE_URL}/about`)
		expect(toCanonicalUrl('/docs/guides/upload/')).toBe(
			`${SITE_URL}/docs/guides/upload`
		)
	})

	it('leaves the site root as the root', () => {
		expect(toCanonicalUrl('/')).toBe(`${SITE_URL}/`)
	})

	it('treats a query as a way of reaching a page, not an address', () => {
		expect(toCanonicalUrl('/news-room?category=launch')).toBe(
			`${SITE_URL}/news-room`
		)
		expect(toCanonicalUrl('/?ref=producthunt')).toBe(`${SITE_URL}/`)
	})

	it('normalizes an already-absolute URL the same way', () => {
		expect(toCanonicalUrl(`${SITE_URL}/imprint/`)).toBe(`${SITE_URL}/imprint`)
	})

	it('is idempotent', () => {
		const once = toCanonicalUrl('/docs/getting-started/')

		expect(toCanonicalUrl(once)).toBe(once)
	})
})

describe('sitemap', () => {
	async function sitemapUrls(): Promise<string[]> {
		const xml = await (await sitemapLoader()).text()

		return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1])
	}

	it('advertises every URL in the form the canonical tags use', async () => {
		const urls = await sitemapUrls()

		expect(urls.length).toBeGreaterThan(0)
		for (const url of urls) {
			expect(url).toBe(toCanonicalUrl(url))
		}
	})

	it('lists each page once', async () => {
		const urls = await sitemapUrls()

		expect(urls).toStrictEqual(Array.from(new Set(urls)))
	})

	it('uses the same origin as the canonical tags', async () => {
		for (const url of await sitemapUrls()) {
			expect(url.startsWith(SITE_URL)).toBe(true)
		}
	})
})

describe('robots.txt', () => {
	it('points at the real sitemap rather than the prerenderer origin', async () => {
		const body = await (await robotsLoader()).text()

		expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
		expect(body).not.toContain('localhost')
	})
})
