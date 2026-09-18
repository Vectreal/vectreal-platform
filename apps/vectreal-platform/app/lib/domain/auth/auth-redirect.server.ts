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

	/*
	  Match the path alone, then return `next` whole.

	  The whitelist used to compare the entire string, so a safe destination that
	  carried parameters failed every prefix test and silently became
	  `/dashboard`. `/publisher?restore_draft=1&draft_id=...` is exactly that URL:
	  the publisher builds it so an anonymous visitor who signs in to save gets
	  the scene back, and with no scene id there is no `/publisher/` segment for
	  the old comparison to match on.

	  Split by hand rather than with `new URL`: a protocol-relative `//evil.com/x`
	  would parse as a host plus a pathname that then looks safe.
	*/
	const pathname = next.split(/[?#]/, 1)[0]

	if (
		SAFE_NEXT_PATH_PREFIXES.some(
			(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
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
