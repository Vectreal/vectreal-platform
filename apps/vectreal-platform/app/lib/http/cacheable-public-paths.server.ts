import {
	CDN_PUBLIC_EXACT_PATHS,
	CDN_PUBLIC_PREFIXES,
	isPublicCacheablePath
} from './cdn-cache-policy.server'
import { hasSupabaseAuthCookie } from '../sessions/supabase-auth-cookie'

export const CACHEABLE_PUBLIC_PATH_LIST = CDN_PUBLIC_EXACT_PATHS

/** Prefix rules: any path under these is a cacheable public path. */
export const CACHEABLE_PUBLIC_PATH_PREFIXES = CDN_PUBLIC_PREFIXES

/**
 * Single cache directive for anonymous public pages. `max-age=0` makes browsers
 * revalidate against the edge (near-fresh for users); `s-maxage=300` protects
 * the origin; a short `stale-while-revalidate=60` avoids the multi-minute stale
 * window the old `swr=300` produced. Only anonymous responses ever reach this
 * branch.
 */
export const PUBLIC_CACHE_CONTROL =
	'public, max-age=0, s-maxage=300, stale-while-revalidate=60'

/**
 * Path-only cacheability check that normalizes the single-fetch `.data` suffix.
 * Exposed so both the request predicate and the Terraform parity test share one
 * implementation.
 */
function isAnonymousCacheablePath(pathname: string): boolean {
	return isPublicCacheablePath(pathname)
}

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

	return isAnonymousCacheablePath(url.pathname)
}
