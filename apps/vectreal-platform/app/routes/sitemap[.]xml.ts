import {
	isCanonicalDeployment,
	resolveDeploymentOrigin
} from '../lib/deployment-origin'
import { docsPages } from '../lib/docs/docs-manifest'
import { getNewsArticles } from '../lib/news/news-manifest'

interface SitemapEntry {
	path: string
	lastmod?: string
	changefreq:
		'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
	priority: string
}

function toDateOnly(dateStr: string): string {
	return dateStr.split('T')[0]
}

function buildXml(entries: SitemapEntry[], baseUrl: string): string {
	const urlElements = entries
		.map(({ path, lastmod, changefreq, priority }) => {
			const loc = `${baseUrl}${path}`
			const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
			return [
				'  <url>',
				`    <loc>${loc}</loc>${lastmodTag}`,
				`    <changefreq>${changefreq}</changefreq>`,
				`    <priority>${priority}</priority>`,
				'  </url>'
			].join('\n')
		})
		.join('\n')

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		urlElements,
		'</urlset>'
	].join('\n')
}

/**
 * XML sitemap endpoint.
 *
 * Lists every public, crawlable URL on the platform grouped into three
 * categories:
 *  1. Static marketing / content pages
 *  2. News Room articles (sourced from the news manifest)
 *  3. Documentation pages (sourced from the docs manifest)
 *
 * Cached at the CDN layer for one hour (s-maxage=3600) and revalidated in the
 * background for up to 24 hours.
 *
 * Not prerendered, for the same reason as robots.txt: the origin has to be the
 * one this deployment actually answers on, so that a mirror's sitemap describes
 * the mirror rather than claiming production's URLs as its own.
 */
export async function loader() {
	const origin = resolveDeploymentOrigin()

	/*
	  A mirror lists nothing. Its robots.txt already answers `Disallow: /`, so
	  anything obeying robots would never fetch this - but the sibling route
	  spends a paragraph on why that is not the protection it looks like:
	  disallowing a path stops the crawl, not the indexing, and a URL handed
	  over by other means still gets listed. A populated sitemap is exactly
	  those other means, at scale and in machine-readable form, for every
	  scraper that skips robots.txt and every hand-submission to Search Console.

	  Empty rather than 404, so the document stays valid for anything that has
	  already been told the URL exists.
	*/
	if (!isCanonicalDeployment(origin)) {
		return new Response(buildXml([], origin), {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=3600, s-maxage=3600'
			}
		})
	}

	// ── 1. Static marketing / content pages ────────────────────────────────
	const staticEntries: SitemapEntry[] = [
		{ path: '/', lastmod: '2026-06-29', changefreq: 'weekly', priority: '1.0' },
		{
			path: '/pricing',
			lastmod: '2026-06-29',
			changefreq: 'monthly',
			priority: '0.8'
		},
		{
			path: '/news-room',
			lastmod: '2026-06-29',
			changefreq: 'daily',
			priority: '0.8'
		},
		{
			path: '/docs',
			lastmod: '2026-06-29',
			changefreq: 'weekly',
			priority: '0.8'
		},
		{
			path: '/about',
			lastmod: '2026-01-19',
			changefreq: 'monthly',
			priority: '0.6'
		},
		{
			path: '/changelog',
			lastmod: '2026-06-29',
			changefreq: 'weekly',
			priority: '0.6'
		},
		{
			path: '/contact',
			lastmod: '2026-01-01',
			changefreq: 'monthly',
			priority: '0.5'
		},
		{
			path: '/code-of-conduct',
			lastmod: '2025-01-01',
			changefreq: 'yearly',
			priority: '0.3'
		},
		{
			path: '/privacy-policy',
			lastmod: '2026-01-01',
			changefreq: 'yearly',
			priority: '0.3'
		},
		{
			path: '/terms-of-service',
			lastmod: '2026-01-01',
			changefreq: 'yearly',
			priority: '0.3'
		},
		{
			path: '/imprint',
			lastmod: '2026-01-19',
			changefreq: 'yearly',
			priority: '0.3'
		}
	]

	// ── 2. News Room articles ───────────────────────────────────────────────
	const newsEntries: SitemapEntry[] = getNewsArticles()
		.filter((article) => !article.draft)
		.filter((article) => Boolean(article.publishedAt))
		.map((article) => ({
			path: `/news-room/${article.slug}`,
			lastmod: toDateOnly(article.updatedAt ?? article.publishedAt),
			changefreq: 'never' as const,
			priority: '0.7'
		}))

	// ── 3. Documentation pages ──────────────────────────────────────────────
	// The docs root `/docs` is not a manifest entry; it is in staticEntries.
	const docsEntries: SitemapEntry[] = docsPages.map((page) => ({
		path: `/docs/${page.slug}`,
		changefreq: 'weekly' as const,
		priority: '0.6'
	}))

	const allEntries = [...staticEntries, ...newsEntries, ...docsEntries]

	const xml = buildXml(allEntries, origin)

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control':
				'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
		}
	})
}
