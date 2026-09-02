/**
 * The messages this list did not used to recognize are the point.
 *
 * Three real GoTrue failures - a confirmation email that could not be sent, the
 * hourly email cap, and a database error saving the user - matched none of the
 * route's old substring heuristic, so all three arrived as the same generic
 * sentence with no report behind it.
 */

import { describe, expect, it } from 'vitest'

import { classifySignupFailure, type SignupFailureCode } from './signup-failure'

const CASES: [string, SignupFailureCode][] = [
	// Cloudflare's own wording, via GoTrue, for a replayed or expired token.
	['captcha protection: request disallowed (timeout-or-duplicate)', 'captcha'],
	['captcha verification process failed', 'captcha'],
	['User already registered', 'already_registered'],
	['Password should be at least 6 characters', 'weak_password'],
	['Password is known to be weak and easy to guess', 'weak_password'],
	['Unable to validate email address: invalid format', 'invalid_email'],
	['Signups not allowed for this instance', 'signups_disabled'],
	['Email signups are disabled', 'signups_disabled'],
	// Matched nothing before this module existed:
	['Error sending confirmation email', 'email_send_failed'],
	['email rate limit exceeded', 'email_rate_limited'],
	[
		'For security purposes, you can only request this after 51 seconds',
		'email_rate_limited'
	],
	['Database error saving new user', 'unknown'],
	/*
	  The strings this deployment actually produces, read from supabase/auth
	  rather than guessed. `[auth.hook.send_email]` is enabled, so GoTrue never
	  runs its own mailer: it invokes our route, reads the response body only on
	  2xx, and on our 500 reports its own wording. "Error sending confirmation
	  email" above is therefore unreachable while the hook is on - it is kept
	  because `[auth.email.smtp]` would take over if the hook were disabled.
	*/
	// Our own wording, via the hook's error envelope on a 200.
	[
		'Auth email delivery failed: Resend rejected the request',
		'email_send_failed'
	],
	['Auth email delivery failed', 'email_send_failed'],
	['Unexpected status code returned from hook: 500', 'email_send_failed'],
	['Invalid payload sent to hook', 'email_send_failed'],
	['Hook requires authorization token', 'email_send_failed'],
	['Service currently unavailable due to hook', 'email_send_failed'],
	['hook_timeout_after_retry', 'email_send_failed']
]

describe('classifySignupFailure', () => {
	it.each(CASES)('classifies %j as %s', (message, code) => {
		expect(classifySignupFailure(message).code).toBe(code)
	})

	it('reports every failure except the one it withholds from the visitor', () => {
		expect(classifySignupFailure('User already registered').report).toBe(false)

		for (const [message, code] of CASES) {
			if (code === 'already_registered') continue
			expect(
				classifySignupFailure(message).report,
				`${message} must be reported`
			).toBe(true)
		}
	})

	/*
	  The form must not answer "does this address have an account". Asserting the
	  exact string rather than a vocabulary blocklist, because every phrasing
	  that leaks - "an account with this email exists", "that address is
	  registered" - gets past a list of banned words.
	*/
	it('never confirms that an address is already registered', () => {
		expect(classifySignupFailure('User already registered').message).toBe(
			'We could not create an account with those details. If you already have one, try signing in or resetting your password.'
		)
	})

	it('keeps an unrecognized message reportable rather than silent', () => {
		const failure = classifySignupFailure('Some GoTrue error nobody has seen')

		expect(failure.code).toBe('unknown')
		expect(failure.report).toBe(true)
		expect(failure.status).toBe(500)
	})

	/*
	  The route calls this with an empty string on both paths where there is no
	  GoTrue verdict to classify: a thrown `signUp`, and a response carrying
	  neither a user nor an error.
	*/
	it('falls back to a reportable unknown when there is no message at all', () => {
		const failure = classifySignupFailure('')

		expect(failure.code).toBe('unknown')
		expect(failure.report).toBe(true)
		expect(failure.status).toBe(500)
		expect(failure.message).toBeTruthy()
	})

	it('answers a client error with 4xx and a server error with 5xx', () => {
		expect(classifySignupFailure('captcha verification failed').status).toBe(
			400
		)
		expect(classifySignupFailure('User already registered').status).toBe(400)
		expect(classifySignupFailure('Password should be longer').status).toBe(400)
		expect(classifySignupFailure('Signups not allowed').status).toBe(400)
		expect(classifySignupFailure('email rate limit exceeded').status).toBe(429)
		expect(
			classifySignupFailure('Error sending confirmation email').status
		).toBe(500)
	})

	/*
	  Must not claim the account exists: GoTrue rolls the user back with the
	  failed send, both being inside one transaction. So it must not send anyone
	  to sign in either - there is no account there to find.
	*/
	it('advises the one recovery path that exists when the email fails', () => {
		const { message } = classifySignupFailure(
			'Error sending confirmation email'
		)

		expect(message).toBe(
			'We could not send your confirmation email. Please try signing up again in a moment.'
		)
		expect(message).not.toMatch(/sign(ing)? in/i)
	})

	it('is case-insensitive, since GoTrue capitalization is not stable', () => {
		expect(classifySignupFailure('USER ALREADY REGISTERED').code).toBe(
			'already_registered'
		)
	})

	/*
	  First match wins, and these two genuinely overlap: "Error sending password
	  reset email" matches both the send-failure pattern and the bare /password/
	  one. Reorder the list and this is the assertion that fails.
	*/
	it('prefers the specific pattern where two genuinely overlap', () => {
		expect(
			classifySignupFailure('Error sending password reset email').code
		).toBe('email_send_failed')
	})
})
