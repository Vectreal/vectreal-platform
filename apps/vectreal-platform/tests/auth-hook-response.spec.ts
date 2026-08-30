/**
 * A contract with somebody else's parser, so it is pinned rather than trusted.
 *
 * Every assertion below is a property of supabase/auth, not a preference:
 * `hookshttp` calls `hookserrors.Check(body)` only on 200 and 202, and
 * `hookserrors` decodes `error` as an object with `http_code` and `message`.
 * Miss any one of those and the reason is silently discarded - which is
 * exactly what the route did before, answering 500 with a string `error`.
 */

import { describe, expect, it } from 'vitest'

import {
	buildHookErrorMessage,
	hookErrorResponse,
	redactAddresses
} from '../app/lib/email/auth-hook-response'

describe('hookErrorResponse', () => {
	/*
	  The status GoTrue gates body-parsing on. A 500 here means the reason is
	  never read, which is the whole defect.
	*/
	it('answers 200, because GoTrue reads a hook body only on 2xx', async () => {
		expect(hookErrorResponse('boom').status).toBe(200)
	})

	it('declares JSON, or the body is never decoded', () => {
		expect(hookErrorResponse('boom').headers.get('content-type')).toBe(
			'application/json'
		)
	})

	/*
	  `error` must be an object. A string parses to no error at all, so the
	  failure would read as a success.
	*/
	it('nests the reason in an error object, not a string', async () => {
		const body = await hookErrorResponse('boom').json()

		expect(typeof body.error).toBe('object')
		expect(body.error).toEqual({ http_code: 500, message: 'boom' })
	})

	/*
	  GoTrue defaults a missing or zero `http_code` to 500, so an envelope that
	  omitted it would still work - but it would stop saying what happened.
	*/
	it('states the status inside the envelope rather than relying on a default', async () => {
		const body = await hookErrorResponse('nope').json()

		expect(body.error.http_code).toBe(500)
	})
})

describe('buildHookErrorMessage', () => {
	/*
	  The prefix is what `classifySignupFailure` matches on. Without it the
	  sign-up action files the failure as `unknown`.
	*/
	it('prefixes the reason so the sign-up classifier recognizes it', () => {
		expect(buildHookErrorMessage(new Error('Invalid API key'))).toBe(
			'Auth email delivery failed: Invalid API key'
		)
	})

	it('still names the failure when there is no reason to add', () => {
		expect(buildHookErrorMessage(new Error(''))).toBe(
			'Auth email delivery failed'
		)
		expect(buildHookErrorMessage(undefined)).toBe('Auth email delivery failed')
	})

	it('accepts something thrown that is not an Error', () => {
		expect(buildHookErrorMessage('plain string')).toBe(
			'Auth email delivery failed: plain string'
		)
	})

	/*
	  This message leaves the process, travels through Supabase and comes back
	  into an error report. A recipient address has no reason to make that trip.
	*/
	it('strips addresses before the reason leaves the process', () => {
		expect(
			buildHookErrorMessage(new Error('could not deliver to jane@example.com'))
		).not.toMatch(/jane@example\.com/)
		expect(redactAddresses('a@b.co and c.d@e.org failed')).toBe(
			'[address] and [address] failed'
		)
	})

	it('bounds the reason, since it ends up in an error report', () => {
		const long = buildHookErrorMessage(new Error('x'.repeat(500)))

		expect(long.length).toBeLessThanOrEqual(
			'Auth email delivery failed: '.length + 200
		)
	})

	/*
	  And bounds it from below. Resend's real messages run to about a hundred
	  characters - "The domain is not verified. Please add and verify your domain
	  on https://resend.com/domains" - so a cap tight enough to chop one would
	  otherwise pass.
	*/
	it('keeps a realistic provider message intact', () => {
		const reason =
			'The domain is not verified. Please add and verify your domain on https://resend.com/domains'

		expect(buildHookErrorMessage(new Error(reason))).toBe(
			`Auth email delivery failed: ${reason}`
		)
	})

	it('trims a padded reason rather than embedding the whitespace', () => {
		expect(buildHookErrorMessage(new Error('  Invalid API key  '))).toBe(
			'Auth email delivery failed: Invalid API key'
		)
	})
})
