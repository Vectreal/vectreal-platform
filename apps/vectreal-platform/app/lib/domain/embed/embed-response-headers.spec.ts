import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { embedRefusal } from './embed-refusal'
import {
	EMBED_RESPONSE_HEADERS,
	mergeEmbedResponseHeaders
} from './embed-response-headers'

/**
 * An embed URL carries its API key in the query string, so the response must
 * not end up anywhere that outlives the request. The failure paths matter more
 * than the success one here: a crawler that finds an embed URL without a token
 * gets the 404, and that is the response most likely to be indexed.
 */

const ORIGINAL = Object.entries(EMBED_RESPONSE_HEADERS)

/*
  What a document actually goes out with: the loader's thrown or returned
  `data(...)` puts its headers into `loaderHeaders`, and the route's `headers`
  export merges them. Driven through both halves, for every refusal the loader
  throws and for the success path.
*/
function sentHeaders(init: ResponseInit | null) {
	return mergeEmbedResponseHeaders(new Headers(init?.headers))
}

const EVERY_RESPONSE = [
	['a 404', embedRefusal('not_available').init],
	['a malformed URL', embedRefusal('not_available', 400).init],
	['a refused domain', embedRefusal('domain_not_allowed').init],
	['a rate limit', embedRefusal('busy').init],
	['the scene', { headers: EMBED_RESPONSE_HEADERS }]
] as const

describe('embed response headers', () => {
	it.each(EVERY_RESPONSE)('keep %s out of search indexes', (_, init) => {
		expect(sentHeaders(init).get('X-Robots-Tag')).toBe('noindex, nofollow')
	})

	it.each(EVERY_RESPONSE)('carry every declared header on %s', (_, init) => {
		for (const [name, value] of ORIGINAL) {
			expect(sentHeaders(init).get(name), `${name} is missing`).toBe(value)
		}
	})

	it('never lets an embed response be stored', () => {
		expect(
			sentHeaders(embedRefusal('not_available').init).get('Cache-Control')
		).toBe('no-store')
	})

	it('does not send a full tokenized URL to another origin', () => {
		/*
		  Matching the browser default rather than tightening past it. The point
		  is that a laxer policy introduced later cannot silently start attaching
		  a tokenized URL to requests leaving the page.
		*/
		expect(
			sentHeaders(embedRefusal('not_available').init).get('Referrer-Policy')
		).toBe('strict-origin-when-cross-origin')
	})

	/*
	  The half the rest of this file cannot see.

	  Everything above proves what the two halves produce together. None of it
	  proves the browser receives it: for a document route, React Router builds
	  the HTTP response with `getDocumentHeaders`, which for a module without a
	  `headers` export keeps only `Set-Cookie` from the loader and discards the
	  rest. This PR's first draft did exactly that - a correct helper, wired into
	  a route that threw its output away, with every assertion above passing.

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
					source.includes('embedRefusal') ||
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
})

describe('mergeEmbedResponseHeaders', () => {
	it('states each header exactly once when the loader already set it', () => {
		// The trap this exists for: `Object.fromEntries` lowercases every name,
		// so `cache-control` never overwrites `Cache-Control`, both reach the
		// record, and `new Headers` fills by append - putting
		// `no-store, no-store` on every embed response.
		const merged = mergeEmbedResponseHeaders(
			new Headers(EMBED_RESPONSE_HEADERS)
		)

		expect(merged.get('cache-control')).toBe('no-store')
		expect(merged.get('x-robots-tag')).toBe('noindex, nofollow')
		expect(merged.get('referrer-policy')).toBe(
			'strict-origin-when-cross-origin'
		)
	})

	it('supplies them when the loader set nothing at all', () => {
		// An uncaught error carries no loader headers, and that 500 document
		// still has the API token in its URL.
		const merged = mergeEmbedResponseHeaders(new Headers())

		expect(merged.get('cache-control')).toBe('no-store')
		expect(merged.get('x-robots-tag')).toBe('noindex, nofollow')
	})

	it('keeps anything else the loader attached', () => {
		const merged = mergeEmbedResponseHeaders(
			new Headers({ 'X-Custom': 'kept' })
		)

		expect(merged.get('x-custom')).toBe('kept')
		expect(merged.get('cache-control')).toBe('no-store')
	})
})
