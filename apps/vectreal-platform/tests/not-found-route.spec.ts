/**
 * Every URL no page owns lands on a route that answers 404.
 *
 * Without one, React Router answers a miss with an internal 404 that wraps an
 * `Error`, hands it to `handleError`, and the root fallback renders it as raw
 * JSON. The paths below are the ones scanners actually sent in September 2026.
 * Matching runs against the real route config, because a not-found module that
 * no route reaches type-checks and tests clean.
 */
import { matchRoutes, type RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PublicErrorBoundary } from '../app/components/errors'
import { EMBED_RESPONSE_HEADERS } from '../app/lib/domain/embed/embed-response-headers'
import routes from '../app/routes'
import {
	action as embedAction,
	headers as embedHeaders,
	loader as embedLoader
} from '../app/routes/embed-page/embed-not-found'
import {
	action,
	ErrorBoundary,
	loader,
	meta
} from '../app/routes/not-found-page'

function matchedFiles(pathname: string) {
	const matches = matchRoutes(routes as unknown as RouteObject[], pathname)
	return (matches ?? []).map((match) => (match.route as { file?: string }).file)
}

function leafFile(pathname: string) {
	return matchedFiles(pathname).at(-1)
}

function thrownBy(handler: () => unknown): unknown {
	try {
		handler()
	} catch (error) {
		return error
	}
	return undefined
}

/*
  The payload is what matters: React Router turns an `Error` payload into the
  thrown error itself, which `handleError` reports. Thrown at all so a fetcher
  aimed at a missing endpoint fails instead of resolving with `null`.
*/
const BARE_404 = { data: null, init: { status: 404 } }

describe('the site-wide not-found route', () => {
	it.each([
		'/.env',
		'/wp-content/themes/',
		'/wp-admin/setup-config.php',
		'/dashboard/projects/p1/folders/f1',
		'/api/not-a-thing'
	])('owns %s', (pathname) => {
		expect(leafFile(pathname)).toBe('./routes/not-found-page.tsx')
	})

	it('leaves unknown docs pages to the docs fallback', () => {
		expect(leafFile('/docs/not-a-page')).toBe(
			'./routes/docs/docs-not-found.tsx'
		)
	})

	it.each([
		['/', './routes/home-page/home-page.tsx'],
		['/pricing', './routes/pricing-page/pricing-page.tsx'],
		[
			'/dashboard/projects/p1/folder/f1',
			'./routes/dashboard-page/projects/folder.tsx'
		],
		['/embed/p1/s1', './routes/embed-page/embed-scene.tsx']
	])('does not shadow %s', (pathname, file) => {
		expect(leafFile(pathname)).toBe(file)
	})

	it.each([
		['loader', loader],
		['action', action]
	])('its %s throws a bare 404', (_, handler) => {
		expect(thrownBy(handler)).toMatchObject(BARE_404)
	})

	/*
	  nav-layout has no boundary of its own, so without this one every unknown
	  URL would fall to root and lose the site nav and footer.
	*/
	it('catches its own 404 with the public boundary', () => {
		expect(ErrorBoundary).toBe(PublicErrorBoundary)
	})

	it('keeps itself out of the index, with no canonical', () => {
		const tags = JSON.stringify(meta())
		expect(tags).toContain('noindex, nofollow')
		expect(tags).not.toContain('canonical')
	})
})

/*
  A malformed embed URL renders inside a customer's iframe and may still carry
  an API key in its query string.
*/
describe('the embed not-found route', () => {
	it.each(['/embed/p1', '/embed/p1/s1/extra'])(
		'answers %s outside the site chrome',
		(pathname) => {
			const files = matchedFiles(pathname)
			expect(files.at(-1)).toBe('./routes/embed-page/embed-not-found.tsx')
			expect(files).not.toContain('./routes/layouts/nav-layout.tsx')
		}
	)

	it('answers with the header contract every embed response carries', () => {
		const sent = embedHeaders({ loaderHeaders: new Headers() } as never)
		expect(Object.fromEntries(sent)).toEqual(
			Object.fromEntries(new Headers(EMBED_RESPONSE_HEADERS))
		)
	})

	it.each([
		['loader', embedLoader],
		['action', embedAction]
	])('its %s throws a bare 404', (_, handler) => {
		expect(thrownBy(handler)).toMatchObject(BARE_404)
	})
})
