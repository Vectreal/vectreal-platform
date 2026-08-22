import { describe, expect, it } from 'vitest'

import {
	isAllowedEmbedHost,
	normalizeDomainPattern,
	parseAllowedDomainPatterns,
	validateAllowedDomainInput
} from '../app/lib/domain/embed/embed-domain-policy'

/**
 * This module decides who may embed a published scene, so it is the security
 * boundary of the product's headline feature. It had no spec at all.
 *
 * The tests below assert the *contract between* the write path
 * (`normalizeDomainPattern`, which turns what an owner typed into a stored
 * pattern) and the read path (`isAllowedEmbedHost`, which decides whether a
 * requesting site matches one). Testing the two halves separately is precisely
 * what let the wildcard feature ship dead: the matcher handled `*.example.com`
 * correctly, and nothing in the product could produce one for it to match, so
 * both halves passed any test written about them alone.
 *
 * That is the same shape as the bug that made every embed 404 - two pieces of
 * code deciding one rule with no shared owner - which is why the invariant, and
 * not the halves, is what gets pinned here.
 */

type DomainCase = {
	/** What the owner types into the project's allowed-domains field. */
	input: string
	/** What must be stored. */
	pattern: string
	/** Sites that must be able to embed. */
	allowed: string[]
	/** Sites that must not. */
	refused: string[]
}

const CASES: DomainCase[] = [
	{
		input: 'example.com',
		pattern: 'example.com',
		allowed: ['example.com', 'EXAMPLE.com', 'example.com.'],
		refused: ['sub.example.com', 'notexample.com', 'example.com.evil.test']
	},
	{
		/*
		  The Shopify case. A merchant's storefront is always a subdomain of
		  myshopify.com, so this is the pattern the product exists to support.
		*/
		input: '*.myshopify.com',
		pattern: '*.myshopify.com',
		allowed: ['my-store.myshopify.com', 'another.myshopify.com'],
		refused: [
			// The apex is Shopify's own marketing site, not a merchant storefront.
			'myshopify.com',
			'evilmyshopify.com',
			'myshopify.com.evil.test'
		]
	},
	{
		input: 'https://shop.example.com/products/thing?x=1',
		pattern: 'shop.example.com',
		allowed: ['shop.example.com'],
		refused: ['example.com', 'other.example.com']
	}
]

describe('embed domain policy', () => {
	describe.each(CASES)('$input', ({ input, pattern, allowed, refused }) => {
		it(`normalizes to ${pattern}`, () => {
			expect(normalizeDomainPattern(input)).toBe(pattern)
		})

		it('is accepted by the project settings validator', () => {
			const result = validateAllowedDomainInput(input)
			expect(result.ok).toBe(true)
			expect(result.ok && result.patterns).toEqual([pattern])
		})

		/*
		  The invariant. A pattern the write path accepts is worthless unless the
		  read path can match a real host against it, and a host the read path
		  refuses must stay refused after a round trip through storage.
		*/
		it.each(allowed)('lets %s embed, end to end', (host) => {
			const stored = parseAllowedDomainPatterns(input)
			expect(isAllowedEmbedHost(host, stored)).toBe(true)
		})

		it.each(refused)('refuses %s, end to end', (host) => {
			const stored = parseAllowedDomainPatterns(input)
			expect(isAllowedEmbedHost(host, stored)).toBe(false)
		})
	})

	describe('rejection', () => {
		it.each([
			['a bare label', 'localhost-ish'],
			['a mid-string wildcard', 'foo.*.example.com'],
			['a trailing wildcard', 'example.*'],
			['an empty value', '   ']
		])('rejects %s', (_label, input) => {
			expect(normalizeDomainPattern(input)).toBeNull()
		})

		it('reports an invalid entry rather than silently dropping it', () => {
			const result = validateAllowedDomainInput('example.com\nfoo.*.example.com')
			expect(result.ok).toBe(false)
		})
	})

	describe('an empty allowlist refuses everything', () => {
		it('refuses any host when no pattern is stored', () => {
			expect(isAllowedEmbedHost('example.com', [])).toBe(false)
		})
	})

	it('deduplicates and accepts a mixed list', () => {
		const stored = parseAllowedDomainPatterns(
			'example.com, *.myshopify.com\nexample.com'
		)
		expect(stored).toEqual(['example.com', '*.myshopify.com'])
	})
})
