import type { AuthErrorCode } from './signin-failure'

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

/*
  `AuthErrorCode`, not `string`. Sign-in resolves `?error=` against
  `AUTH_ERROR_MESSAGES`, and a code absent from that table resolves to null - so
  a visitor bounced back from a failed OAuth round trip would land on a bare
  form with no banner explaining why. Typing it makes that a compile error at
  the emitter instead of silence at the destination.
*/
export function buildSigninErrorRedirect(
	errorCode: AuthErrorCode,
	next: string
): string {
	const params = new URLSearchParams({ error: errorCode, next })
	return `/sign-in?${params.toString()}`
}
