interface ScopedRevalidationArgs {
	currentPathname: string
	nextPathname: string
	formMethod?: string | null
	actionResult?: unknown
	actionStatus?: number
	defaultShouldRevalidate: boolean
	scopePrefix: string
}

interface ParamRevalidationArgs {
	currentParams: Record<string, string | undefined>
	nextParams: Record<string, string | undefined>
	paramKeys: string[]
	formMethod?: string | null
	actionResult?: unknown
	actionStatus?: number
	defaultShouldRevalidate: boolean
}

/**
 * Whether the action behind this revalidation was refused, and so changed
 * nothing worth reloading.
 *
 * React Router's own default already skips revalidation for an action status
 * of 400 or more; the routes here answer yes to any POST before consulting it,
 * so they have to ask this first. It matters most when the refusal is the
 * network itself: a page that reloads its data after an offline write fails
 * that reload too, and the failed loaders replace the page with its error
 * boundary.
 */
export function isRefusedAction(actionStatus: number | undefined): boolean {
	return actionStatus !== undefined && actionStatus >= 400
}

const DASHBOARD_OVERLAY_ROUTE_PATTERNS = [
	/^\/dashboard\/projects\/new$/,
	/^\/dashboard\/projects\/[^/]+\/edit$/,
	/^\/dashboard\/projects\/edit\/[^/]+$/,
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
	actionStatus,
	defaultShouldRevalidate,
	scopePrefix
}: ScopedRevalidationArgs): boolean {
	if (isRefusedAction(actionStatus)) {
		return false
	}

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
	actionStatus,
	defaultShouldRevalidate
}: ParamRevalidationArgs): boolean {
	if (isRefusedAction(actionStatus)) {
		return false
	}

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
