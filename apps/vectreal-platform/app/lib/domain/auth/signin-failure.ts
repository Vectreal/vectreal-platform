/**
 * What a failed sign-in tells the visitor, and what it tells us.
 *
 * Mirrors `signup-failure.ts`, and exists for the same reason: the route
 * classified Supabase's error by substring-matching English text inline, where
 * nothing could test it, and anything it did not recognize became a 500 plus a
 * reported server error.
 *
 * The case that made this worth extracting is `email_not_confirmed`. GoTrue
 * answers a correct password on an unconfirmed account with a 400 and "Email
 * not confirmed"; the route matched none of its patterns, so the visitor got
 * "Unable to sign in right now. Please try again.", the response was a 500, and
 * every affected person filed a false server-error alert. The one screen that
 * could fix it - the resend gate - was reachable only from a successful
 * sign-up.
 *
 * Safe to act on, and this is the load-bearing detail: GoTrue verifies the
 * password *before* it reports a missing confirmation
 * (`ResourceOwnerPasswordGrant` returns `invalid_credentials` first), so this
 * code is only reachable by someone who already has the password. Telling them
 * the account needs confirming discloses nothing they could not already
 * establish, which is why it does not have to stay vague the way sign-up's
 * `already_registered` does.
 *
 * Pure, so a spec can reach it: a route module cannot be imported by a test.
 */

export type AuthErrorCode =
	| 'verification_failed'
	| 'provider_exchange_failed'
	| 'user_init_failed'
	| 'email_conflict'
	| 'email_not_confirmed'
	| 'missing_code'
	| 'session_missing'
	| 'rate_limited'
	| 'invalid_credentials'
	| 'unknown'

/**
 * Also read by the loader, which resolves `?error=` codes that the OAuth
 * callback and the confirm route put in the URL. One table for both, so a code
 * cannot mean one thing on a redirect and another in a form response.
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
	verification_failed:
		'We could not verify your email link. Please request a new one and try again.',
	provider_exchange_failed:
		'Authentication provider sign-in failed. Please try again.',
	user_init_failed:
		'Your account was authenticated, but setup could not be completed. Please try signing in again.',
	email_conflict:
		'An account with this email already exists. Please sign in with your existing method (e.g. Google or GitHub).',
	email_not_confirmed:
		'Please confirm your email address before signing in. We can send you a new link.',
	missing_code:
		'Missing authentication code. Please restart the sign-in flow and try again.',
	session_missing: 'Session creation failed. Please sign in again.',
	rate_limited: 'Too many sign-in attempts. Please try again shortly.',
	invalid_credentials: 'Invalid email or password.',
	unknown: 'Unable to sign in right now. Please try again.'
}

export interface SigninFailure {
	code: AuthErrorCode
	message: string
	status: 400 | 401 | 429 | 500
	/** Whether this warrants a report. False where the cause is the visitor. */
	report: boolean
}

/*
  Ordered, first match wins. `captcha` leads because a replayed Turnstile token
  is the failure most likely to be our fault rather than the visitor's, and it
  must not be swallowed by a broader pattern.
*/
const PATTERNS: { code: AuthErrorCode; match: RegExp }[] = [
	{ code: 'verification_failed', match: /captcha|turnstile/ },
	{ code: 'email_not_confirmed', match: /not confirmed|email not confirmed/ },
	{ code: 'invalid_credentials', match: /invalid login credentials/ },
	{ code: 'rate_limited', match: /rate limit|too many requests/ }
]

const STATUS: Record<AuthErrorCode, 400 | 401 | 429 | 500> = {
	verification_failed: 400,
	provider_exchange_failed: 400,
	user_init_failed: 500,
	email_conflict: 400,
	email_not_confirmed: 400,
	missing_code: 400,
	session_missing: 400,
	rate_limited: 429,
	invalid_credentials: 401,
	unknown: 500
}

/*
  Only `unknown` and a failed account bootstrap are ours. A wrong password, an
  unconfirmed address and a rate limit are all the visitor's side of the
  exchange and would bury the feed. A captcha rejection reports because the
  last one was a bug in our own token handling, not in anyone's browser.
*/
const SILENT: ReadonlySet<AuthErrorCode> = new Set<AuthErrorCode>([
	'invalid_credentials',
	'email_not_confirmed',
	'rate_limited'
])

export function classifySigninFailure(supabaseMessage: string): SigninFailure {
	const normalized = supabaseMessage.toLowerCase()
	const code =
		PATTERNS.find(({ match }) => match.test(normalized))?.code ?? 'unknown'

	return {
		code,
		message: AUTH_ERROR_MESSAGES[code],
		status: STATUS[code],
		report: !SILENT.has(code)
	}
}
