import { describe, expect, it } from 'vitest'

import {
	resolveClientIp,
	UNKNOWN_CLIENT
} from '../app/lib/http/client-identity'

/**
 * Every assertion here is about not trusting the caller.
 *
 * The embed limiter keyed on `x-forwarded-for`, which the caller writes. One
 * fabricated value per request gave every request a fresh identity, so the
 * limiter counted to one and never fired - it was not a weak limit, it was no
 * limit at all.
 */

const headersWith = (init: Record<string, string>) => new Headers(init)

describe('resolveClientIp', () => {
	it('prefers the header the edge sets over the one the caller sends', () => {
		const headers = headersWith({
			'x-forwarded-for': '1.2.3.4',
			'cf-connecting-ip': '203.0.113.10'
		})

		expect(resolveClientIp(headers)).toBe('203.0.113.10')
	})

	it('never takes an identity from x-forwarded-for alone', () => {
		// The whole spoof: with no trustworthy header present, a caller-supplied
		// address must not become the rate-limit key.
		const headers = headersWith({ 'x-forwarded-for': '1.2.3.4' })

		expect(resolveClientIp(headers)).toBe(UNKNOWN_CLIENT)
	})

	it('gives every spoofing attempt the same identity', () => {
		/*
		  The property that matters. Rotating the header must not rotate the key,
		  or the limit is per-request and therefore not a limit.
		*/
		const identities = ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((forged) =>
			resolveClientIp(headersWith({ 'x-forwarded-for': forged }))
		)

		expect(new Set(identities).size).toBe(1)
	})

	it('falls back to the Fly proxy header when Cloudflare is not in front', () => {
		const headers = headersWith({
			'fly-client-ip': '198.51.100.7',
			'x-forwarded-for': '1.2.3.4'
		})

		expect(resolveClientIp(headers)).toBe('198.51.100.7')
	})

	it('prefers Cloudflare over Fly when both are present', () => {
		const headers = headersWith({
			'cf-connecting-ip': '203.0.113.10',
			'fly-client-ip': '198.51.100.7'
		})

		expect(resolveClientIp(headers)).toBe('203.0.113.10')
	})

	it('reports unknown when nothing trustworthy is present', () => {
		expect(resolveClientIp(headersWith({}))).toBe(UNKNOWN_CLIENT)
	})

	it('does not accept a blank trusted header as an identity', () => {
		const headers = headersWith({
			'cf-connecting-ip': '   ',
			'fly-client-ip': '198.51.100.7'
		})

		expect(resolveClientIp(headers)).toBe('198.51.100.7')
	})

	it('trims a trusted header rather than keying on the whitespace', () => {
		const headers = headersWith({ 'cf-connecting-ip': ' 203.0.113.10 ' })

		expect(resolveClientIp(headers)).toBe('203.0.113.10')
	})
})
