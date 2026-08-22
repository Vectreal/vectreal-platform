import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	checkRateLimit,
	recordRateLimitAttempt,
	__rateLimitKeyCountForTest,
	__rateLimitMaxEntriesForTest,
	__resetRateLimitsForTest
} from '../app/lib/http/rate-limit.server'

/**
 * The limiter three copies of this code got subtly different.
 *
 * The interesting cases are the ones the embed copy got wrong: an identity a
 * caller can rotate at will, and a map that only ever grew. The cross-window
 * cases below are the ones the consolidation itself got wrong, and they are
 * invisible to any test that uses a single window.
 */

const LIMIT = { bucket: 'test', maxRequests: 3, windowMs: 60_000 }

/** The two real window lengths in production, with their real limits. */
const SHORT = { bucket: 'embed-auth', maxRequests: 60, windowMs: 60_000 }
const LONG = { bucket: 'contact-form', maxRequests: 5, windowMs: 600_000 }

function requestFrom(ip: string, headerName = 'cf-connecting-ip') {
	return new Request('https://vectreal.com/embed/p/s', {
		headers: { [headerName]: ip }
	})
}

beforeEach(() => {
	__resetRateLimitsForTest()
	vi.useFakeTimers()
	vi.setSystemTime(new Date('2026-08-22T12:00:00.000Z'))
})

afterEach(() => {
	vi.useRealTimers()
	__resetRateLimitsForTest()
})

describe('recordRateLimitAttempt', () => {
	it('allows up to the limit and refuses the one after', () => {
		const request = requestFrom('203.0.113.10')

		for (let attempt = 1; attempt <= LIMIT.maxRequests; attempt += 1) {
			expect(
				recordRateLimitAttempt(request, LIMIT).limited,
				`attempt ${attempt}`
			).toBe(false)
		}

		expect(recordRateLimitAttempt(request, LIMIT).limited).toBe(true)
	})

	it('counts each caller separately', () => {
		const first = requestFrom('203.0.113.10')
		const second = requestFrom('198.51.100.7')

		for (let i = 0; i < LIMIT.maxRequests + 1; i += 1) {
			recordRateLimitAttempt(first, LIMIT)
		}

		expect(recordRateLimitAttempt(second, LIMIT).limited).toBe(false)
	})

	it('keeps unrelated buckets apart', () => {
		const request = requestFrom('203.0.113.10')

		for (let i = 0; i < LIMIT.maxRequests + 1; i += 1) {
			recordRateLimitAttempt(request, LIMIT)
		}

		expect(
			recordRateLimitAttempt(request, { ...LIMIT, bucket: 'other' }).limited
		).toBe(false)
	})

	it('narrows the limit by keyParts', () => {
		const request = requestFrom('203.0.113.10')

		for (let i = 0; i < LIMIT.maxRequests + 1; i += 1) {
			recordRateLimitAttempt(request, { ...LIMIT, keyParts: ['a@example.com'] })
		}

		expect(
			recordRateLimitAttempt(request, { ...LIMIT, keyParts: ['b@example.com'] })
				.limited
		).toBe(false)
	})

	it('forgets attempts once the window has passed', () => {
		const request = requestFrom('203.0.113.10')

		for (let i = 0; i < LIMIT.maxRequests + 1; i += 1) {
			recordRateLimitAttempt(request, LIMIT)
		}
		expect(checkRateLimit(request, LIMIT).limited).toBe(true)

		vi.advanceTimersByTime(LIMIT.windowMs + 1)

		expect(checkRateLimit(request, LIMIT).limited).toBe(false)
	})

	it('reports how long the caller has to wait', () => {
		const request = requestFrom('203.0.113.10')

		for (let i = 0; i < LIMIT.maxRequests + 1; i += 1) {
			recordRateLimitAttempt(request, LIMIT)
		}

		expect(checkRateLimit(request, LIMIT).retryAfterSeconds).toBe(60)
	})

	/*
	  The spoof, end to end. The embed limiter keyed on `x-forwarded-for`, so a
	  caller rotating that header got a fresh counter every request.
	*/
	it('cannot be escaped by rotating a caller-supplied header', () => {
		for (let i = 0; i < LIMIT.maxRequests; i += 1) {
			recordRateLimitAttempt(
				requestFrom(`10.0.0.${i}`, 'x-forwarded-for'),
				LIMIT
			)
		}

		const next = requestFrom('10.0.0.99', 'x-forwarded-for')
		expect(recordRateLimitAttempt(next, LIMIT).limited).toBe(true)
	})

	it('does not grow without bound as identities churn', () => {
		/*
		  Asserted on the map's size, not on behaviour. Every read filters by
		  window, so an evicted key and a merely-stale one answer identically -
		  the first version of this test checked that answer and passed with
		  eviction deleted.
		*/
		for (let i = 0; i < 500; i += 1) {
			recordRateLimitAttempt(requestFrom(`203.0.113.${i}`), LIMIT)
		}

		expect(__rateLimitKeyCountForTest()).toBeGreaterThan(100)

		vi.advanceTimersByTime(LIMIT.windowMs + 1)

		// Enough further requests to cross the eviction interval and sweep.
		for (let i = 0; i < 60; i += 1) {
			recordRateLimitAttempt(requestFrom('198.51.100.7'), LIMIT)
		}

		expect(
			__rateLimitKeyCountForTest(),
			'aged-out identities were never removed, so a caller minting them grows the map without bound'
		).toBeLessThan(10)
	})

	it('does not let a short-window bucket evict a long-window one', () => {
		/*
		  The defect the single-window tests above cannot see. Seven buckets share
		  one map across two window lengths. The sweep must filter each key by the
		  window it was recorded under; applying the calling bucket's cutoff to
		  every key means any address probing embed tokens - a 60s bucket, swept
		  roughly once a minute - silently cleared every 10-minute auth and
		  contact limit on the instance.
		*/
		const victim = requestFrom('203.0.113.10')
		const prober = requestFrom('198.51.100.7')

		for (let i = 0; i <= LONG.maxRequests; i += 1) {
			recordRateLimitAttempt(victim, LONG)
		}
		expect(checkRateLimit(victim, LONG).limited).toBe(true)

		// Two minutes in: past the short window, nowhere near the long one.
		vi.advanceTimersByTime(120_000)

		// Enough short-window traffic to cross the eviction interval and sweep.
		for (let i = 0; i < 60; i += 1) {
			recordRateLimitAttempt(prober, SHORT)
		}

		expect(
			checkRateLimit(victim, LONG).limited,
			'a 60s bucket swept the 10-minute bucket with its own cutoff, resetting the limit 8 minutes early'
		).toBe(true)
	})

	it('admits a caller that waits exactly as long as it was told to', () => {
		/*
		  Recording an already-limited caller extended their own block, so each
		  obedient retry pushed the readmission out again and a client honouring
		  `Retry-After` to the second was never let in.
		*/
		const request = requestFrom('203.0.113.10')

		for (let i = 0; i < LONG.maxRequests; i += 1) {
			recordRateLimitAttempt(request, LONG)
			vi.advanceTimersByTime(10_000)
		}

		const refused = recordRateLimitAttempt(request, LONG)
		expect(refused.limited).toBe(true)

		vi.advanceTimersByTime(refused.retryAfterSeconds * 1000)

		expect(
			recordRateLimitAttempt(request, LONG).limited,
			'the caller waited exactly the advertised time and was refused again'
		).toBe(false)
	})

	it('retains no more timestamps than the limit allows', () => {
		/*
		  Size again, not behaviour: a capped and an uncapped array answer
		  `limited` identically. Uncapped, a caller held at the limit grew their
		  own array once per rejected request, and every request re-filtered the
		  whole thing.
		*/
		const request = requestFrom('203.0.113.10')

		for (let i = 0; i < 200; i += 1) {
			recordRateLimitAttempt(request, LIMIT)
		}

		expect(
			__rateLimitMaxEntriesForTest(),
			'a blocked caller kept growing its own timestamp array'
		).toBeLessThanOrEqual(LIMIT.maxRequests)
	})

	it('bounds how much key material one request can contribute', () => {
		/*
		  The auth routes pass the submitted email as a key part, validated for an
		  `@` and no length, with no body size limit configured. Unbounded, one
		  request turns a multi-megabyte field into a map key held for the window.
		*/
		const request = requestFrom('203.0.113.10')
		const shared = 'a'.repeat(200)

		for (let i = 0; i < LIMIT.maxRequests + 1; i += 1) {
			recordRateLimitAttempt(request, {
				...LIMIT,
				keyParts: [`${shared}-one@example.com`]
			})
		}

		expect(
			recordRateLimitAttempt(request, {
				...LIMIT,
				keyParts: [`${shared}-two@example.com`]
			}).limited,
			'key parts are not truncated, so a caller mints a fresh bucket per request'
		).toBe(true)
	})
})

describe('checkRateLimit', () => {
	it('does not count the request it is asked about', () => {
		const request = requestFrom('203.0.113.10')

		for (let i = 0; i < 20; i += 1) {
			expect(checkRateLimit(request, LIMIT).limited).toBe(false)
		}
	})

	it('reports limited once the recorded attempts reach the maximum', () => {
		const request = requestFrom('203.0.113.10')

		for (let i = 0; i < LIMIT.maxRequests; i += 1) {
			recordRateLimitAttempt(request, LIMIT)
		}

		expect(checkRateLimit(request, LIMIT).limited).toBe(true)
	})

	it('agrees with record on which request is the first refused', () => {
		/*
		  Both now test `>= maxRequests`; the only difference is whether the
		  request being asked about is in the array. The embed path relies on this
		  agreeing, since it checks on every request and records only failures.
		*/
		const checked = requestFrom('203.0.113.10')
		const recorded = requestFrom('198.51.100.7')

		for (let i = 1; i <= LIMIT.maxRequests + 2; i += 1) {
			const viaCheck = checkRateLimit(checked, LIMIT).limited
			if (!viaCheck) {
				recordRateLimitAttempt(checked, LIMIT)
			}

			const viaRecord = recordRateLimitAttempt(recorded, LIMIT).limited

			expect(viaCheck, `request ${i}`).toBe(viaRecord)
		}
	})
})
