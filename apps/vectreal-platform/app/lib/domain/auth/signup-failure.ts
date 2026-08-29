/**
 * What a failed sign-up tells the visitor, and what it tells us.
 *
 * The route used to fold every Supabase failure into one of two fixed
 * sentences, chosen by substring-matching the English message, and then
 * deliberately skipped `reportServerError` for the whole branch it called a
 * client error. A captcha rejection - the most common real failure, and for a
 * while a guaranteed one, because a spent Turnstile token was being replayed -
 * produced no reason for the visitor and no trace for anyone else. The account
 * creation funnel's first step was the one place in the app that reported
 * nothing.
 *
 * Two rules follow from that, and they are why this is a module rather than a
 * branch in the route:
 *
 *   1. Every code reports except `already_registered`, which is withheld from
 *      the visitor and so has nothing to investigate.
 *   2. An unrecognized message reports. The visitor still gets the generic
 *      sentence - there is nothing useful to tell them - but the call site
 *      sends the original text along with the `unknown` code, so a failure
 *      nobody has seen before is legible on its first occurrence instead of
 *      looking exactly like one we already understand.
 *
 * Pure, and free of any database or Supabase import, so a spec can exercise it
 * directly - a route module cannot be imported by a test, because `getDbClient`
 * throws at module scope.
 */

export type SignupFailureCode =
	| 'captcha'
	| 'already_registered'
	| 'weak_password'
	| 'invalid_email'
	| 'signups_disabled'
	| 'email_send_failed'
	| 'email_rate_limited'
	| 'unknown'

export interface SignupFailure {
	code: SignupFailureCode
	/** Shown to the visitor. Never names whether an address has an account. */
	message: string
	status: 400 | 429 | 500
	/** Whether this warrants a report. False only where there is nothing to learn. */
	report: boolean
}

/*
  Ordered, because several of these overlap: "Unable to validate email address:
  invalid format" contains "invalid", and "Error sending confirmation email"
  contains "email". First match wins, so the specific patterns come first.
*/
const PATTERNS: { code: SignupFailureCode; match: RegExp }[] = [
	{ code: 'captcha', match: /captcha|turnstile/ },
	{
		code: 'already_registered',
		match: /already registered|already been registered/
	},
	/*
	  `hook` carries this project, and "error sending" never fires here.

	  `config.toml` enables `[auth.hook.send_email]` against `/auth/send-email`,
	  so GoTrue never runs its own mailer and never emits "Error sending
	  confirmation email".

	  `delivery failed` is our own wording, and the usual case. The hook route
	  answers a Resend failure with GoTrue's error envelope on a 200, which is
	  the only shape GoTrue reads a reason out of, so what arrives here is our
	  message rather than a status-code sentence.

	  `hook` still covers GoTrue's own failures, which never reach our route's
	  catch and so carry its wording instead: "Invalid payload sent to hook",
	  "Hook requires authorization token", "Service currently unavailable due to
	  hook", `hook_timeout`, and "Unexpected status code returned from hook" if
	  the route ever throws before it can answer.

	  The SMTP wording stays because `[auth.email.smtp]` is still configured and
	  would take over if the hook were ever disabled.
	*/
	{
		code: 'email_send_failed',
		match: /delivery failed|error sending|failed to send|smtp|hook/
	},
	{
		code: 'email_rate_limited',
		match: /rate limit|too many requests|only request this after/
	},
	{
		code: 'invalid_email',
		match: /validate email|invalid format|invalid email/
	},
	{ code: 'weak_password', match: /password/ },
	{ code: 'signups_disabled', match: /signups (not allowed|are disabled)/ }
]

const MESSAGES: Record<SignupFailureCode, string> = {
	/*
	  Deliberately does not name a cause. The pattern fires for an expired token,
	  a replayed one and an outright invalid one, and the widget runs in
	  `interaction-only` mode, so most people never saw a challenge to blame.
	  Retrying mints a fresh token, which is the only thing they can act on.
	*/
	captcha: 'We could not verify your request. Please try again.',
	/*
	  Says nothing about whether this address has an account. The form would
	  otherwise answer that question for anyone who asked it, which is what makes
	  a sign-up form an enumeration oracle.
	*/
	already_registered:
		'We could not create an account with those details. If you already have one, try signing in or resetting your password.',
	weak_password:
		'That password was rejected. Please choose a longer or less common one.',
	invalid_email: 'That email address does not look valid. Please check it.',
	signups_disabled:
		'New sign-ups are paused right now. Please try again later.',
	/*
	  "Sign up again" rather than "sign in", and the difference is not cosmetic.

	  GoTrue wraps `signupNewUser` and the confirmation send in one transaction
	  and returns the send error from inside it, so a failed send rolls the user
	  back: there is no account to sign in to, and signing in would answer
	  "Invalid email or password". Sign-in does now route an unconfirmed account
	  to the resend gate, but that is a different state from this one - it needs
	  an account that exists.
	*/
	email_send_failed:
		'We could not send your confirmation email. Please try signing up again in a moment.',
	email_rate_limited:
		'Too many confirmation emails have been requested for this address. Please wait before trying again.',
	unknown: 'We could not create your account right now. Please try again.'
}

const STATUS: Record<SignupFailureCode, 400 | 429 | 500> = {
	captcha: 400,
	already_registered: 400,
	weak_password: 400,
	invalid_email: 400,
	signups_disabled: 400,
	email_rate_limited: 429,
	email_send_failed: 500,
	unknown: 500
}

export function classifySignupFailure(supabaseMessage: string): SignupFailure {
	const normalized = supabaseMessage.toLowerCase()
	const code =
		PATTERNS.find(({ match }) => match.test(normalized))?.code ?? 'unknown'

	return {
		code,
		message: MESSAGES[code],
		status: STATUS[code],
		report: code !== 'already_registered'
	}
}
