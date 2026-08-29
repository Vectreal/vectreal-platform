/**
 * The case this module exists for is `email_not_confirmed`.
 *
 * GoTrue answers a correct password on an unconfirmed account with "Email not
 * confirmed". The route's old substring heuristic matched none of its patterns,
 * so the visitor got the generic sentence, the response was a 500, and every
 * affected person filed a false server-error alert.
 */

import { describe, expect, it } from 'vitest'

import {
	AUTH_ERROR_MESSAGES,
	classifySigninFailure,
	type AuthErrorCode
} from '../app/lib/domain/auth/signin-failure'

const CASES: [string, AuthErrorCode][] = [
	// The exact string from supabase/auth `internal/api/token.go`.
	['Email not confirmed', 'email_not_confirmed'],
	['Invalid login credentials', 'invalid_credentials'],
	[
		'captcha protection: request disallowed (timeout-or-duplicate)',
		'verification_failed'
	],
	['captcha verification process failed', 'verification_failed'],
	['Request rate limit reached', 'rate_limited'],
	['Something GoTrue has never said before', 'unknown']
]

describe('classifySigninFailure', () => {
	it.each(CASES)('classifies %j as %s', (message, code) => {
		expect(classifySigninFailure(message).code).toBe(code)
	})

	/*
	  Nothing else reads `.message` off a classification, and it is what the route
	  renders. Wire every code to `unknown`'s sentence and the suite was otherwise
	  green while every failed sign-in read "Unable to sign in right now" - which
	  is the regression this module exists to undo.
	*/
	it('gives each code its own sentence, not the generic one', () => {
		expect(classifySigninFailure('Email not confirmed').message).toBe(
			AUTH_ERROR_MESSAGES.email_not_confirmed
		)
		expect(classifySigninFailure('Invalid login credentials').message).toBe(
			AUTH_ERROR_MESSAGES.invalid_credentials
		)
		expect(classifySigninFailure('a message with no pattern').message).toBe(
			AUTH_ERROR_MESSAGES.unknown
		)
	})

	/*
	  The regression that mattered: an unconfirmed account is a normal state, not
	  a server fault. Reporting it filed a false alert for every affected person,
	  and answering 500 told the browser our side had broken.
	*/
	it('treats an unconfirmed account as the visitor’s state, not a fault', () => {
		const failure = classifySigninFailure('Email not confirmed')

		expect(failure.report).toBe(false)
		expect(failure.status).toBe(400)
	})

	it('does not report the failures the visitor causes', () => {
		for (const message of [
			'Invalid login credentials',
			'Email not confirmed',
			'Request rate limit reached'
		]) {
			expect(
				classifySigninFailure(message).report,
				`${message} must not be reported`
			).toBe(false)
		}
	})

	/*
	  A rejected captcha is the one visitor-facing failure worth reporting: the
	  last one was our own token handling replaying a spent challenge, not
	  anything the visitor did.
	*/
	it('reports a rejected captcha and an unrecognized message', () => {
		expect(classifySigninFailure('captcha verification failed').report).toBe(
			true
		)
		expect(classifySigninFailure('a message with no pattern').report).toBe(true)
	})

	it('answers a wrong password with 401 and an unknown failure with 500', () => {
		expect(classifySigninFailure('Invalid login credentials').status).toBe(401)
		expect(classifySigninFailure('a message with no pattern').status).toBe(500)
	})

	it('answers a rate limit with 429, which goes out on the wire', () => {
		expect(classifySigninFailure('Request rate limit reached').status).toBe(429)
	})

	/*
	  A captcha rejection used to answer 500, because the old branch sent
	  everything but a wrong password down the server-error path.
	*/
	it('answers a rejected captcha with 4xx rather than 5xx', () => {
		expect(classifySigninFailure('captcha verification failed').status).toBe(
			400
		)
	})

	it('is case-insensitive, since GoTrue capitalization is not stable', () => {
		expect(classifySigninFailure('EMAIL NOT CONFIRMED').code).toBe(
			'email_not_confirmed'
		)
	})

	/*
	  The loader resolves `?error=` codes put in the URL by the OAuth callback and
	  the confirm route, and reads the same table. A code that classifies to
	  nothing there would render `undefined`.
	*/
	it('gives every code a message the loader can render', () => {
		/*
		  The whole table, not just the codes this module classifies. The five it
		  does not - `provider_exchange_failed`, `user_init_failed`,
		  `email_conflict`, `missing_code`, `session_missing` - reach the loader
		  only as `?error=` in a URL, from the OAuth callback and the confirm
		  route, and are exactly the ones iterating the classified cases misses.
		*/
		for (const code of Object.keys(AUTH_ERROR_MESSAGES) as AuthErrorCode[]) {
			expect(AUTH_ERROR_MESSAGES[code], `${code} needs a message`).toBeTruthy()
		}
		expect(AUTH_ERROR_MESSAGES.email_not_confirmed).toMatch(/confirm/i)
	})
})
