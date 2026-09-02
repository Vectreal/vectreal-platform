import { describe, expect, it } from 'vitest'

import {
	isCanonicalDeployment,
	resolveDeploymentOrigin
} from './deployment-origin'
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

/**
 * `APPLICATION_URL` is pinned for every case below.
 *
 * These loaders used to read a build-time constant, so ambient environment
 * could not reach them and none of this was needed. They read
 * `process.env.APPLICATION_URL` now, and `setup-fly-secrets.sh` sources
 * `.env.development` under `set -a` - so a developer who ran that script in the
 * same shell would otherwise get failures here from a spec unrelated to
 * whatever they were changing.
 */
function withApplicationUrl<T>(value: string | undefined, run: () => T): T {
	const previous = process.env.APPLICATION_URL

	if (value === undefined) {
		delete process.env.APPLICATION_URL
	} else {
		process.env.APPLICATION_URL = value
	}

	try {
		return run()
	} finally {
		if (previous === undefined) {
			delete process.env.APPLICATION_URL
		} else {
			process.env.APPLICATION_URL = previous
		}
	}
}

describe('sitemap', () => {
	async function sitemapUrls(): Promise<string[]> {
		const xml = await withApplicationUrl(SITE_URL, () => sitemapLoader()).then(
			(response) => response.text()
		)

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
		const body = await withApplicationUrl(SITE_URL, () => robotsLoader()).then(
			(response) => response.text()
		)

		expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
		expect(body).not.toContain('localhost')
	})
})

/**
 * The one document that has to say something different per environment.
 *
 * Every page is built once and served by both Fly apps, so anything derived
 * from `SITE_URL` is identical on staging and production by construction. That
 * is right for a canonical tag and wrong here: staging shipped production's
 * rules, told crawlers `Allow: /`, and advertised production's sitemap.
 */
describe('a mirror deployment does not invite crawlers', () => {
	const STAGING = 'https://staging.vectreal.com'

	const robotsFor = (applicationUrl: string | undefined) =>
		withApplicationUrl(applicationUrl, () => robotsLoader()).then((response) =>
			response.text()
		)

	const sitemapLocsFor = (applicationUrl: string | undefined) =>
		withApplicationUrl(applicationUrl, () => sitemapLoader())
			.then((response) => response.text())
			.then((xml) =>
				Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1])
			)

	/**
	 * Compared line by line, not as substrings.
	 *
	 * `expect(body).toContain('Disallow: /')` passes against the *production*
	 * body, because `Disallow: /dashboard` contains it - so the assertion that
	 * looks like it pins the mirror rule is satisfied by the rule set it exists
	 * to distinguish from.
	 */
	const linesOf = (body: string) =>
		body
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)

	const hasLine = (body: string, prefix: string) =>
		linesOf(body).some((line) => line.startsWith(prefix))

	it('disallows everything when the origin is not the canonical site', async () => {
		const body = await robotsFor(STAGING)

		expect(linesOf(body)).toContain('Disallow: /')
		expect(hasLine(body, 'Allow:')).toBe(false)
		// Advertising production's sitemap from a mirror is what pointed
		// crawlers at the wrong host in the first place.
		expect(hasLine(body, 'Sitemap:')).toBe(false)
		// A blanket disallow and a path list are different documents; shipping
		// both would leave the path rules deciding nothing.
		expect(hasLine(body, 'Disallow: /dashboard')).toBe(false)
	})

	it('serves the real rules on the canonical site', async () => {
		const body = await robotsFor(SITE_URL)

		expect(linesOf(body)).toContain('Allow: /')
		expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
	})

	/*
	  The comparison is by host, so none of these spellings may read as a
	  different site. Each one on production would otherwise serve `Disallow: /`
	  - and since these responses carry `s-maxage=86400` and Cloudflare respects
	  the origin, that answer would sit at the edge for a day.
	*/
	it.each([
		['a trailing slash', `${SITE_URL}/`],
		['surrounding whitespace', `  ${SITE_URL}  `],
		['an uppercase host', 'https://VECTREAL.com'],
		['a plain-http scheme', 'http://vectreal.com'],
		['a stray path segment', `${SITE_URL}/app`]
	])('still recognises the canonical site given %s', async (_label, value) => {
		expect(linesOf(await robotsFor(value))).toContain('Allow: /')
	})

	/*
	  The failure direction matters more than the check. If the value that
	  decides this goes missing or arrives unparseable, the answer has to be
	  "this is the real site" - a fail-closed default would have production
	  serving `Disallow: /` and deindexing itself, silently, exactly the way a
	  missing variable took the server error sink down.
	*/
	it.each([
		['unset', undefined],
		['empty', ''],
		['not a URL at all', 'vectreal.com']
	])(
		'keeps the canonical site crawlable when the origin is %s',
		async (_label, value) => {
			const body = await robotsFor(value)

			expect(linesOf(body)).toContain('Allow: /')
			expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
		}
	)

	/*
	  The sibling route spends a paragraph on why `Disallow` stops the crawl and
	  not the indexing. A populated sitemap is the other means by which a URL
	  gets discovered, so a mirror that disallowed everything and then handed
	  over a full inventory would be fail-closed in one document and wide open
	  in the next.
	*/
	it('gives a mirror an empty sitemap rather than an inventory', async () => {
		expect(await sitemapLocsFor(STAGING)).toStrictEqual([])
	})

	it('still lists the site on the canonical deployment', async () => {
		const locs = await sitemapLocsFor(SITE_URL)

		expect(locs.length).toBeGreaterThan(0)
		for (const loc of locs) {
			expect(loc.startsWith(SITE_URL)).toBe(true)
		}
	})

	it('never emits a loc without a scheme, whatever the origin holds', async () => {
		for (const loc of await sitemapLocsFor('vectreal.com')) {
			expect(loc).toMatch(/^https?:\/\//)
		}
	})
})

/**
 * The resolver on its own, because the loaders cannot reach all of it.
 *
 * `resolveDeploymentOrigin` substitutes `SITE_URL` for anything unparseable
 * before `isCanonicalDeployment` ever sees it, so going through robots.txt
 * proves the fallback and never the fail-open branch behind it. A mutation
 * making that branch fail *closed* left the whole suite green.
 */
describe('deployment origin resolution', () => {
	it.each([
		['unset', undefined, SITE_URL],
		['empty', '', SITE_URL],
		['whitespace only', '   ', SITE_URL],
		['missing a scheme', 'vectreal.com', SITE_URL],
		['a non-http scheme', 'ftp://vectreal.com', SITE_URL],
		['a trailing slash', `${SITE_URL}/`, SITE_URL],
		['a path', `${SITE_URL}/app`, SITE_URL],
		['an uppercase host', 'https://VECTREAL.com', SITE_URL],
		['a mirror', 'https://staging.vectreal.com', 'https://staging.vectreal.com']
	])('resolves %s to a usable origin', (_label, value, expected) => {
		expect(resolveDeploymentOrigin(value)).toBe(expected)
	})

	it('never returns something that cannot go in a sitemap loc', () => {
		for (const value of [undefined, '', 'vectreal.com', 'ftp://x', '://']) {
			expect(resolveDeploymentOrigin(value)).toMatch(/^https?:\/\/[^/]+$/)
		}
	})

	/*
	  Fail open, deliberately. These responses carry `s-maxage=86400` and
	  Cloudflare respects the origin, so a deployment wrongly judged a mirror
	  serves `Disallow: /` from the edge for a day.
	*/
	it.each([
		['an unparseable origin', 'vectreal.com'],
		['a non-http scheme', 'ftp://vectreal.com'],
		['an empty string', '']
	])('counts %s as the canonical site rather than a mirror', (_label, value) => {
		expect(isCanonicalDeployment(value)).toBe(true)
	})

	it.each([
		['a different host', 'https://staging.vectreal.com'],
		['a subdomain', 'https://preview.vectreal.com'],
		['a different domain entirely', 'https://example.com']
	])('counts %s as a mirror', (_label, value) => {
		expect(isCanonicalDeployment(value)).toBe(false)
	})
})
