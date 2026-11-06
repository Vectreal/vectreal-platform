import { describe, expect, it } from 'vitest'

import { handleDataRequest } from '../app/entry.server'
import { PUBLIC_CACHE_CONTROL } from '../app/lib/http/cacheable-public-paths.server'

import type { LoaderFunctionArgs } from 'react-router'

/**
 * The 200 GET branches of the cache policy, reached the way production reaches
 * them for a single-fetch `.data` response. React Router does not carry a
 * loader's headers onto that response, so `handleDataRequest` is the only thing
 * standing between a signed-in visitor's data and the edge cache.
 */

const PUBLIC_DATA_URL = 'https://vectreal.com/about.data'

function cacheControlOf(request: Request, response = new Response('{}')) {
	return handleDataRequest(response, {
		request
	} as LoaderFunctionArgs).headers.get('Cache-Control')
}

describe('cache headers on a 200 .data response', () => {
	it('are no-store for a signed-in visitor, even on a public path', () => {
		const request = new Request(PUBLIC_DATA_URL, {
			headers: { cookie: 'sb-project-auth-token=session' }
		})

		expect(cacheControlOf(request)).toBe('no-store')
	})

	it('are the public directive for an anonymous visitor on a public path', () => {
		expect(cacheControlOf(new Request(PUBLIC_DATA_URL))).toBe(
			PUBLIC_CACHE_CONTROL
		)
	})

	it('keep a directive the route already set', () => {
		const response = new Response('{}', {
			headers: { 'Cache-Control': 'private, max-age=60' }
		})

		expect(cacheControlOf(new Request(PUBLIC_DATA_URL), response)).toBe(
			'private, max-age=60'
		)
	})
})
