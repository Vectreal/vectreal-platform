import { describe, expect, it } from 'vitest'

import { resolveClientIp, UNKNOWN_CLIENT } from './client-identity'

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

	it('does not take an identity from fly-client-ip', () => {
		/*
		  It reads as the natural fallback and is not one. Every hostname pointing
		  at the Fly app is proxied through Cloudflare, so Fly Proxy's peer is a
		  Cloudflare edge address, not the visitor. Keying on it would put every
		  visitor behind one edge into a single bucket.
		*/
		const headers = headersWith({ 'fly-client-ip': '198.51.100.7' })

		expect(resolveClientIp(headers)).toBe(UNKNOWN_CLIENT)
	})

	it('reports unknown when nothing trustworthy is present', () => {
		expect(resolveClientIp(headersWith({}))).toBe(UNKNOWN_CLIENT)
	})

	it('does not accept a blank trusted header as an identity', () => {
		expect(resolveClientIp(headersWith({ 'cf-connecting-ip': '   ' }))).toBe(
			UNKNOWN_CLIENT
		)
	})

	it('trims a trusted header rather than keying on the whitespace', () => {
		const headers = headersWith({ 'cf-connecting-ip': ' 203.0.113.10 ' })

		expect(resolveClientIp(headers)).toBe('203.0.113.10')
	})

	it('reads the header case-insensitively', () => {
		// Relied on everywhere and previously unasserted.
		const headers = headersWith({ 'CF-Connecting-IP': '203.0.113.10' })

		expect(resolveClientIp(headers)).toBe('203.0.113.10')
	})

	it('keys on the first entry when the header arrives repeated', () => {
		/*
		  Node joins repeated headers with ", " before this sees them, as does
		  `Headers.append`. Cloudflare documents one address per header, so a
		  comma means something upstream of that guarantee - keying on the joined
		  string would let whoever supplied either half steer the key.
		*/
		const headers = new Headers()
		headers.append('cf-connecting-ip', '203.0.113.10')
		headers.append('cf-connecting-ip', '1.2.3.4')

		expect(resolveClientIp(headers)).toBe('203.0.113.10')
	})

	it('refuses a value too long to be an address', () => {
		// Otherwise the header becomes arbitrary key material, retained for the
		// whole window, one entry per request.
		const headers = headersWith({ 'cf-connecting-ip': 'x'.repeat(4096) })

		expect(resolveClientIp(headers)).toBe(UNKNOWN_CLIENT)
	})

	it('refuses a value that is not shaped like an address', () => {
		const headers = headersWith({ 'cf-connecting-ip': 'not an ip' })

		expect(resolveClientIp(headers)).toBe(UNKNOWN_CLIENT)
	})

	it('accepts IPv6', () => {
		const headers = headersWith({ 'cf-connecting-ip': '2001:db8::1' })

		expect(resolveClientIp(headers)).toBe('2001:db8::1')
	})
})
