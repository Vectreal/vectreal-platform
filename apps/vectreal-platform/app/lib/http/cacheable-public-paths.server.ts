import { hasSupabaseAuthCookie } from '../sessions/supabase-auth-cookie'

const CACHEABLE_PUBLIC_PATH_LIST = [
	'/',
	'/home',
	'/about',
	'/changelog',
	'/code-of-conduct',
	'/contact',
	'/privacy-policy',
	'/terms-of-service',
	'/imprint',
	'/robots.txt',
	'/sitemap.xml',
	'/llms.txt'
] as const

export const CACHEABLE_PUBLIC_PATHS = new Set(CACHEABLE_PUBLIC_PATH_LIST)
const CACHEABLE_PUBLIC_PATHS_SET: ReadonlySet<string> = CACHEABLE_PUBLIC_PATHS

export function isCacheablePublicPath(pathname: string): boolean {
	if (CACHEABLE_PUBLIC_PATHS_SET.has(pathname)) {
		return true
	}

	return pathname.startsWith('/docs') || pathname.startsWith('/news-room')
}

/**
 * Cache directive for anonymous public pages. Short shared TTL keeps the origin
 * light without serving stale personalized content, since only anonymous
 * responses ever reach this branch.
 */
export const PUBLIC_CACHE_CONTROL =
	'public, max-age=0, s-maxage=60, stale-while-revalidate=300'

/**
 * Single source of truth for "may this response be cached publicly?". A response
 * is cacheable only when it carries no per-visitor state, and the one signal for
 * that is the absence of the Supabase auth cookie (consent and theme are
 * client-hydrated, so their cookies never affect cacheability).
 */
export function isAnonymousCacheableRequest(request: Request): boolean {
	if (request.method !== 'GET') return false
	if (request.headers.has('authorization')) return false
	if (hasSupabaseAuthCookie(request.headers.get('cookie'))) return false

	const url = new URL(request.url)
	if (url.search.length > 0) return false

	// Single-fetch loader requests hit the same URL with a `.data` suffix
	// (`/about` → `/about.data`). Normalize it so the data response inherits the
	// same cache policy as its document.
	const pathname = url.pathname.endsWith('.data')
		? url.pathname.slice(0, -'.data'.length)
		: url.pathname

	return isCacheablePublicPath(pathname)
}

/** Headers applied to an anonymous, publicly cacheable response. */
export function publicCacheHeaders(): Headers {
	const headers = new Headers()
	headers.set('Cache-Control', PUBLIC_CACHE_CONTROL)
	headers.set('Vary', 'Accept-Encoding')
	return headers
}
