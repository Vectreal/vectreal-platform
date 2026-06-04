export const SAFE_NEXT_PATH_PREFIXES = [
	'/dashboard',
	'/publisher',
	'/onboarding',
	'/home',
	'/reset-password'
] as const

export function getSafeNextPath(next: string | null): string {
	if (!next || !next.startsWith('/')) {
		return '/dashboard'
	}

	if (
		SAFE_NEXT_PATH_PREFIXES.some(
			(prefix) => next === prefix || next.startsWith(`${prefix}/`)
		)
	) {
		return next
	}

	return '/dashboard'
}

export function buildSigninErrorRedirect(
	errorCode: string,
	next: string
): string {
	const params = new URLSearchParams({ error: errorCode, next })
	return `/sign-in?${params.toString()}`
}
