import { SITE_URL } from '../lib/seo'

/**
 * robots.txt endpoint.
 *
 * Grants crawlers access to all public marketing / content pages and blocks
 * every authenticated, user-specific, or API path that should never appear in
 * search results.
 *
 * The Sitemap directive points crawlers to the XML sitemap so they can
 * discover all canonical URLs in one request.
 *
 * The origin comes from `SITE_URL` rather than the request. This route is
 * prerendered, so the request origin at build time is the prerenderer's
 * throwaway localhost port, and that is what would ship to production.
 */
export async function loader() {
	const origin = SITE_URL

	const robotsTxt = [
		'User-agent: *',
		'Allow: /',
		'Allow: /llms.txt',
		'',
		'# Authenticated / private pages',
		'Disallow: /dashboard',
		'Disallow: /onboarding',
		'Disallow: /preview',
		/*
		  `/embed` is deliberately absent, and adding it would make things worse.

		  Those URLs carry an API key in the query string, so keeping them out of
		  search results matters. Disallowing a path stops the crawl, not the
		  indexing: a URL discovered elsewhere can still be listed, with no
		  snippet, and Google cannot see the `noindex` it was told to obey because
		  it is no longer allowed to fetch the page and read it.

		  `/embed` answers every request with `X-Robots-Tag: noindex, nofollow`
		  (`embed-response-headers.ts`) and renders the matching meta tag. Both
		  require the crawler to be allowed in.
		*/
		'',
		'# API and auth endpoints',
		'Disallow: /api/',
		'Disallow: /auth/',
		'',
		'# Auth UI pages',
		'Disallow: /sign-in',
		'Disallow: /sign-up',
		'',
		'# Authenticated home alias',
		'Disallow: /home',
		'',
		'# LLM-readable index',
		`# ${origin}/llms.txt`,
		`Sitemap: ${origin}/sitemap.xml`
	].join('\n')

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400, s-maxage=86400'
		}
	})
}
