/**
 * The confirmation link an auth email carries.
 *
 * THE CONTRACT: `redirectTo` is where the visitor ends up, and its path
 * becomes the link's `next`, which `/auth/confirm` resolves once the token is
 * verified. That matches Supabase's own meaning of `emailRedirectTo`.
 *
 * Callers once passed the confirmation URL itself, with their data in its
 * query, so everything they sent arrived one level down, inside `next`,
 * where `getSafeNextPath` turned it into `/dashboard`: a signup from the
 * publisher's "sign in to save" lost its draft, and the referral parameters
 * never reached the signup event. Pass the destination; data that has to
 * survive the round trip goes on the account, not the link.
 *
 * Pure, so a test can run the whole chain from the signup action through this
 * link to the confirm route.
 */

const AUTH_CONFIRM_PATH = '/auth/confirm'

export function resolveNextPath(redirectTo: string | undefined): string | null {
	if (!redirectTo) return null
	try {
		const parsed = new URL(redirectTo)
		if (parsed.pathname.startsWith('/')) {
			const next = `${parsed.pathname}${parsed.search}${parsed.hash}`
			return next === '/' ? null : next
		}
	} catch {
		if (redirectTo.startsWith('/')) return redirectTo
	}
	return null
}

export function buildConfirmLink(args: {
	siteUrl: string
	tokenHash: string
	type: string
	redirectTo?: string
}): string {
	const url = new URL(AUTH_CONFIRM_PATH, args.siteUrl)
	url.searchParams.set('token_hash', args.tokenHash)
	url.searchParams.set('type', args.type)
	const next = resolveNextPath(args.redirectTo)
	if (next) url.searchParams.set('next', next)
	return url.toString()
}
