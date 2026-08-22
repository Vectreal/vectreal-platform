import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	checkRateLimit,
	recordRateLimitAttempt,
	__rateLimitKeyCountForTest,
	__resetRateLimitsForTest
} from '../app/lib/http/rate-limit.server'

/**
 * The limiter three copies of this code got subtly different.
 *
 * The interesting cases are the ones the embed copy got wrong: an identity a
 * caller can rotate at will, and a map that only ever grew.
 */

const LIMIT = { bucket: 'test', maxRequests: 3, windowMs: 60_000 }

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

		// `>=` here, unlike record's `>`: the request being asked about has not
		// been counted, so reaching the maximum already means the next is refused.
		expect(checkRateLimit(request, LIMIT).limited).toBe(true)
	})
})
