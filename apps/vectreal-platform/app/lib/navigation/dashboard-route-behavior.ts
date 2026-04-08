interface ScopedRevalidationArgs {
	currentPathname: string
	nextPathname: string
	formMethod?: string | null
	actionResult?: unknown
	defaultShouldRevalidate: boolean
	scopePrefix: string
}

interface ParamRevalidationArgs {
	currentParams: Record<string, string | undefined>
	nextParams: Record<string, string | undefined>
	paramKeys: string[]
	formMethod?: string | null
	actionResult?: unknown
	defaultShouldRevalidate: boolean
}

const DASHBOARD_OVERLAY_ROUTE_PATTERNS = [
	/^\/dashboard\/projects\/new$/,
	/^\/dashboard\/projects\/[^/]+\/edit$/,
	/^\/dashboard\/api-keys\/new$/,
	/^\/dashboard\/api-keys\/[^/]+\/edit$/,
	/^\/dashboard\/organizations\/[^/]+$/,
	/^\/publisher(?:\/|$)/
]

export function isDashboardOverlayPath(pathname: string): boolean {
	return DASHBOARD_OVERLAY_ROUTE_PATTERNS.some((pattern) =>
		pattern.test(pathname)
	)
}

export function shouldRevalidateWithinScope({
	currentPathname,
	nextPathname,
	formMethod,
	actionResult,
	defaultShouldRevalidate,
	scopePrefix
}: ScopedRevalidationArgs): boolean {
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	if (actionResult) {
		return true
	}

	if (currentPathname === nextPathname) {
		return false
	}

	if (
		currentPathname.startsWith(scopePrefix) &&
		nextPathname.startsWith(scopePrefix)
	) {
		return false
	}

	return defaultShouldRevalidate
}

export function shouldRevalidateForRouteParams({
	currentParams,
	nextParams,
	paramKeys,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}: ParamRevalidationArgs): boolean {
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	if (actionResult) {
		return true
	}

	const hasTrackedParamChanges = paramKeys.some(
		(key) => currentParams[key] !== nextParams[key]
	)

	if (!hasTrackedParamChanges) {
		return false
	}

	return defaultShouldRevalidate
}
