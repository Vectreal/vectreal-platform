import type { LoaderFunctionArgs } from 'react-router'

/**
 * robots.txt endpoint.
 *
 * Grants crawlers access to all public marketing / content pages and blocks
 * every authenticated, user-specific, or API path that should never appear in
 * search results.
 *
 * The Sitemap directive points crawlers to the XML sitemap so they can
 * discover all canonical URLs in one request.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const origin = new URL(request.url).origin

	const robotsTxt = [
		'User-agent: *',
		'Allow: /',
		'',
		'# Authenticated / private pages',
		'Disallow: /dashboard',
		'Disallow: /publisher',
		'Disallow: /onboarding',
		'Disallow: /preview',
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
		`Sitemap: ${origin}/sitemap.xml`
	].join('\n')

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400, s-maxage=86400'
		}
	})
}
