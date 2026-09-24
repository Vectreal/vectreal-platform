/**
 * `/privacy` and `/terms` answer with a permanent redirect to the real pages.
 *
 * Both 404'd from March 2026, and Search Console listed them as the site's
 * not-found pages. The routes are asserted from the route config too, because
 * a redirect module that no route reaches type-checks and tests clean.
 */
import { describe, expect, it } from 'vitest'

import routes from '../app/routes'
import { LEGAL_SHORT_LINKS, loader } from '../app/routes/legal-short-link'

function redirectFor(path: string) {
	const response = loader({
		request: new Request(`https://vectreal.test${path}`),
		params: {},
		context: {}
	} as never) as Response
	return { status: response.status, location: response.headers.get('Location') }
}

describe('the legal short links', () => {
	it.each(Object.entries(LEGAL_SHORT_LINKS))(
		'%s moves permanently to %s',
		(from, to) => {
			expect(redirectFor(from)).toEqual({ status: 301, location: to })
		}
	)

	it('keeps the query string, so tracking on inbound links survives', () => {
		expect(redirectFor('/privacy?utm_source=x').location).toBe(
			'/privacy-policy?utm_source=x'
		)
	})

	it('is reachable: every short link is a route in the config', () => {
		const paths = routes.map((route) => `/${route.path}`)
		for (const from of Object.keys(LEGAL_SHORT_LINKS)) {
			expect(paths).toContain(from)
		}
	})
})
