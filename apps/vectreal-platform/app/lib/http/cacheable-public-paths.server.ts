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
