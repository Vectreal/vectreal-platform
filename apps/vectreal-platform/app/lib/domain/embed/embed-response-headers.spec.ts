import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ApiResponse } from '@shared/utils'
import { describe, expect, it } from 'vitest'

import {
	EMBED_RESPONSE_HEADERS,
	withEmbedResponseHeaders
} from './embed-response-headers'

/**
 * An embed URL carries its API key in the query string, so the response must
 * not end up anywhere that outlives the request. The failure paths matter more
 * than the success one here: a crawler that finds an embed URL without a token
 * gets the 404, and that is the response most likely to be indexed.
 */

const ORIGINAL = Object.entries(EMBED_RESPONSE_HEADERS)

describe('embed response headers', () => {
	it('tells crawlers not to index, whatever the status', () => {
		const responses = [
			ApiResponse.notFound('Scene not found'),
			ApiResponse.forbidden('Forbidden'),
			ApiResponse.error('Too many requests', 429),
			ApiResponse.badRequest('Bad request'),
			new Response('ok', { status: 200 })
		]

		for (const response of responses) {
			const wrapped = withEmbedResponseHeaders(response)

			expect(
				wrapped.headers.get('X-Robots-Tag'),
				`status ${wrapped.status} is indexable`
			).toBe('noindex, nofollow')
		}
	})

	it('keeps every declared header on every status', () => {
		for (const [name, value] of ORIGINAL) {
			const wrapped = withEmbedResponseHeaders(
				ApiResponse.notFound('Scene not found')
			)

			expect(wrapped.headers.get(name), `${name} is missing`).toBe(value)
		}
	})

	it('never lets an embed response be stored', () => {
		const wrapped = withEmbedResponseHeaders(new Response('ok'))

		expect(wrapped.headers.get('Cache-Control')).toBe('no-store')
	})

	it('does not send a full tokenized URL to another origin', () => {
		const wrapped = withEmbedResponseHeaders(new Response('ok'))

		/*
		  Matching the browser default rather than tightening past it. The point
		  is that a laxer policy introduced later cannot silently start attaching
		  a tokenized URL to requests leaving the page.
		*/
		expect(wrapped.headers.get('Referrer-Policy')).toBe(
			'strict-origin-when-cross-origin'
		)
	})

	it('preserves the status and body it was handed', async () => {
		const wrapped = withEmbedResponseHeaders(
			new Response('scene payload', { status: 418 })
		)

		expect(wrapped.status).toBe(418)
		expect(await wrapped.text()).toBe('scene payload')
	})

	it('keeps headers the response already carried', () => {
		const response = new Response('ok', {
			headers: { 'Set-Cookie': 'session=abc' }
		})

		expect(withEmbedResponseHeaders(response).headers.get('Set-Cookie')).toBe(
			'session=abc'
		)
	})

	/*
	  The half the rest of this file cannot see.

	  Everything above proves the helper returns the right `Response`. None of it
	  proves the browser receives one: for a document route, React Router builds
	  the HTTP response with `getDocumentHeaders`, which for a module without a
	  `headers` export keeps only `Set-Cookie` from the loader and discards the
	  rest. This PR's first draft did exactly that - a correct helper, wired into
	  a route that threw its output away, with all seven assertions above passing.

	  So the invariant is between the two halves: anything that builds these
	  headers in a loader has to export `headers` as well, or it is setting them
	  into nothing.
	*/
	describe('the routes that use them actually propagate them', () => {
		const APP_ROOT = resolve(
			dirname(fileURLToPath(import.meta.url)),
			'../../../..'
		)

		function collectRouteFiles(dir: string): string[] {
			return readdirSync(dir).flatMap((entry) => {
				const full = join(dir, entry)
				if (statSync(full).isDirectory()) return collectRouteFiles(full)
				return /\.tsx?$/.test(entry) ? [full] : []
			})
		}

		const usingRoutes = collectRouteFiles(join(APP_ROOT, 'app/routes'))
			.map((file) => ({ file, source: readFileSync(file, 'utf8') }))
			.filter(
				({ source }) =>
					source.includes('withEmbedResponseHeaders') ||
					source.includes('EMBED_RESPONSE_HEADERS')
			)

		it('finds at least one route using them', () => {
			// Without this the filter could silently match nothing and the check
			// below would pass by asserting over an empty list.
			expect(usingRoutes.length).toBeGreaterThan(0)
		})

		it.each(usingRoutes.map(({ file }) => file.replace(APP_ROOT, '')))(
			'%s exports headers, so the loader values survive',
			(relative) => {
				const { source } = usingRoutes.find(({ file }) =>
					file.endsWith(relative)
				)!

				expect(
					/export function headers\b|export const headers\b/.test(source),
					`${relative} builds embed response headers in its loader but does not export "headers". React Router keeps only Set-Cookie from a loader on a document route, so X-Robots-Tag, Referrer-Policy and Cache-Control are discarded before the response is sent.`
				).toBe(true)

				expect(
					source.includes('loaderHeaders'),
					`${relative} exports "headers" but does not forward loaderHeaders, so the values the loader set are still dropped.`
				).toBe(true)
			}
		)
	})

	it('overrides a weaker value rather than appending to it', () => {
		// `set`, not `append`. Two Cache-Control values would let the permissive
		// one win depending on who parses it.
		const response = new Response('ok', {
			headers: { 'Cache-Control': 'public, max-age=86400' }
		})

		expect(
			withEmbedResponseHeaders(response).headers.get('Cache-Control')
		).toBe('no-store')
	})
})
