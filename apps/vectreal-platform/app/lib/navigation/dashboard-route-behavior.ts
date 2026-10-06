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

/** What an action answers when its request never reached the server. */
export interface UnreachableActionResult {
	unreachable: true
}

/**
 * Whether the action behind this revalidation never reached the server.
 *
 * The routes here reload their data after any POST, and that is load-bearing
 * for a refusal: a 401 reloads the layout into its sign-in redirect, a 403
 * reloads root into a fresh CSRF token, a confirmation refusal reloads the
 * plan the dialog reads. An unreachable action is the one case where the
 * reload cannot help and does harm: offline it fails too, and the failed
 * loaders replace the page with its error boundary. So only an action that
 * says so outright (`postSceneAction`) skips it.
 */
export function isUnreachableAction(actionResult: unknown): boolean {
	return (
		typeof actionResult === 'object' &&
		actionResult !== null &&
		(actionResult as Partial<UnreachableActionResult>).unreachable === true
	)
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
	defaultShouldRevalidate,
	scopePrefix
}: ScopedRevalidationArgs): boolean {
	if (isUnreachableAction(actionResult)) {
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
	defaultShouldRevalidate
}: ParamRevalidationArgs): boolean {
	if (isUnreachableAction(actionResult)) {
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
