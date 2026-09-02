import {
	isCanonicalDeployment,
	resolveDeploymentOrigin
} from '../lib/deployment-origin'

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
 * Not prerendered, unlike the pages it describes. This is the one document that
 * has to differ per environment, and a prerendered one cannot: it was built
 * from `SITE_URL`, a build-time constant, so staging served production's rules
 * and advertised production's sitemap while inviting crawlers in with
 * `Allow: /`. `resolveDeploymentOrigin` reads a runtime value instead, which
 * needs a request to render against.
 *
 * Cloudflare merges its own managed robots.txt over this response - the
 * `Content-Signal` line and the AI-crawler blocks come from the edge, not from
 * here - so what a crawler finally reads is this body plus those rules.
 */
export async function loader() {
	const origin = resolveDeploymentOrigin()

	/*
	  A mirror competes with the site it mirrors. Staging carries the same
	  content under a different host, so letting it be crawled splits the signal
	  between two copies and can surface a half-finished build in search.

	  Keyed on the origin rather than on an environment name: if the value that
	  decides this ever goes missing, the fallback is the canonical origin, so
	  the failure mode is staging staying crawlable rather than production
	  telling every crawler to leave.
	*/
	if (!isCanonicalDeployment(origin)) {
		return new Response(
			['User-agent: *', 'Disallow: /', '', `# Mirror of ${origin}`].join('\n'),
			{
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Cache-Control': 'public, max-age=86400, s-maxage=86400'
				}
			}
		)
	}

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
