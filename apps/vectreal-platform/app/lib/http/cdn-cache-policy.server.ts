/**
 * Single source of truth for CDN/public cache eligibility by route family.
 * Keep this file aligned with terraform/cloudflare.tf Rule 2 expression.
 */
export const CDN_PUBLIC_EXACT_PATHS = [
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

/** Public route families that remain cacheable for anonymous GET requests. */
export const CDN_PUBLIC_PREFIXES = ['/docs', '/news-room'] as const

/**
 * Protected/app route families that must stay fail-closed (non-public cache).
 * These are used by tests as explicit policy guardrails.
 */
export const CDN_PROTECTED_PREFIXES = [
	'/dashboard',
	'/publisher',
	'/preview',
	'/onboarding',
	'/api',
	'/auth'
] as const

const CRAWL_FILE_PATHS = new Set(['/robots.txt', '/sitemap.xml', '/llms.txt'])
const PUBLIC_EXACT_PATHS = new Set<string>(CDN_PUBLIC_EXACT_PATHS)

/** React Router single-fetch path normalizer for `*.data` requests. */
export function normalizePathForCachePolicy(pathname: string): string {
	return pathname.endsWith('.data')
		? pathname.slice(0, -'.data'.length)
		: pathname
}

export function isPublicCacheablePath(pathname: string): boolean {
	const normalized = normalizePathForCachePolicy(pathname)

	if (PUBLIC_EXACT_PATHS.has(normalized)) {
		return true
	}

	return CDN_PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

export function isProtectedRouteFamilyPath(pathname: string): boolean {
	const normalized = normalizePathForCachePolicy(pathname)
	return CDN_PROTECTED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

/** Exact public paths that require explicit .data variants in Cloudflare Rule 2. */
export const CDN_PUBLIC_EXACT_DATA_VARIANTS = CDN_PUBLIC_EXACT_PATHS
	.filter((path) => !CRAWL_FILE_PATHS.has(path))
	.map((path) => (path === '/' ? '/.data' : `${path}.data`))
