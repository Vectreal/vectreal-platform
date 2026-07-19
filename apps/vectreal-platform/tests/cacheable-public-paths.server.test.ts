import { describe, expect, it } from 'vitest'

import {
	CACHEABLE_PUBLIC_PATH_LIST,
	CACHEABLE_PUBLIC_PATH_PREFIXES,
	isAnonymousCacheableRequest,
	PUBLIC_CACHE_CONTROL
} from '../app/lib/http/cacheable-public-paths.server'

function req(url: string, headers: Record<string, string> = {}): Request {
	return new Request(url, { headers })
}

const AUTH_COOKIE = 'sb-abcdef-auth-token=eyJhbGc; other=1'

describe('PUBLIC_CACHE_CONTROL', () => {
	it('uses the single tuned directive (max-age=0, s-maxage=300, swr=60)', () => {
		expect(PUBLIC_CACHE_CONTROL).toBe(
			'public, max-age=0, s-maxage=300, stale-while-revalidate=60'
		)
	})
})

describe('exported allowlist sources', () => {
	it('exposes the raw path list and prefixes for the parity guard', () => {
		expect(CACHEABLE_PUBLIC_PATH_LIST).toContain('/')
		expect(CACHEABLE_PUBLIC_PATH_LIST).toContain('/about')
		expect(CACHEABLE_PUBLIC_PATH_PREFIXES).toEqual(['/docs', '/news-room'])
	})
})

describe('isAnonymousCacheableRequest', () => {
	it('caches an anonymous GET to an allowlisted path', () => {
		expect(isAnonymousCacheableRequest(req('https://x.test/about'))).toBe(true)
	})

	it('caches the .data variant of an allowlisted path', () => {
		expect(isAnonymousCacheableRequest(req('https://x.test/about.data'))).toBe(
			true
		)
	})

	it('does NOT cache when the Supabase auth cookie is present', () => {
		expect(
			isAnonymousCacheableRequest(
				req('https://x.test/about', { cookie: AUTH_COOKIE })
			)
		).toBe(false)
	})

	it('does NOT cache a chunked Supabase auth cookie (sb-...-auth-token.0)', () => {
		expect(
			isAnonymousCacheableRequest(
				req('https://x.test/about', {
					cookie: 'sb-abcdef-auth-token.0=part; x=1'
				})
			)
		).toBe(false)
	})

	it('does NOT cache when a query string is present', () => {
		expect(isAnonymousCacheableRequest(req('https://x.test/about?x=1'))).toBe(
			false
		)
	})

	it('does NOT cache a non-allowlisted path', () => {
		expect(isAnonymousCacheableRequest(req('https://x.test/dashboard'))).toBe(
			false
		)
	})

	it('caches nested docs/news-room prefixes', () => {
		expect(
			isAnonymousCacheableRequest(req('https://x.test/docs/guides/upload'))
		).toBe(true)
		expect(
			isAnonymousCacheableRequest(req('https://x.test/news-room/some-slug'))
		).toBe(true)
	})
})
