import { docsPages } from '../lib/docs/docs-manifest'
import { getNewsArticles } from '../lib/news/news-manifest'

import type { LoaderFunctionArgs } from 'react-router'

interface SitemapEntry {
	path: string
	lastmod?: string
	changefreq:
		| 'always'
		| 'hourly'
		| 'daily'
		| 'weekly'
		| 'monthly'
		| 'yearly'
		| 'never'
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
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const origin = new URL(request.url).origin

	// ── 1. Static marketing / content pages ────────────────────────────────
	const staticEntries: SitemapEntry[] = [
		{ path: '/', changefreq: 'weekly', priority: '1.0' },
		{ path: '/pricing', changefreq: 'monthly', priority: '0.8' },
		{ path: '/news-room', changefreq: 'daily', priority: '0.8' },
		{ path: '/docs', changefreq: 'weekly', priority: '0.8' },
		{ path: '/about', changefreq: 'monthly', priority: '0.6' },
		{ path: '/changelog', changefreq: 'weekly', priority: '0.6' },
		{ path: '/contact', changefreq: 'monthly', priority: '0.5' },
		{ path: '/code-of-conduct', changefreq: 'yearly', priority: '0.3' },
		{ path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
		{ path: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
		{ path: '/imprint', changefreq: 'yearly', priority: '0.3' }
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
	const docsEntries: SitemapEntry[] = docsPages.map((page) => ({
		path: page.slug ? `/docs/${page.slug}` : '/docs',
		changefreq: 'weekly' as const,
		priority: '0.6'
	}))

	// Deduplicate by path (docs root `/docs` is already in staticEntries)
	const allEntries = [
		...staticEntries,
		...newsEntries,
		...docsEntries.filter((e) => e.path !== '/docs')
	]

	const xml = buildXml(allEntries, origin)

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
		}
	})
}
