/**
 * Every URL no page owns lands on a route that answers 404.
 *
 * Without one, React Router answers a miss with an internal 404 that wraps an
 * `Error`, hands it to `handleError`, and the root fallback renders it as raw
 * JSON. The paths below are the ones scanners actually sent in September 2026.
 * Matching runs against the real route config, because a not-found module that
 * no route reaches type-checks and tests clean.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	matchRoutes,
	type RouteObject,
	UNSAFE_ErrorResponseImpl as ErrorResponseImpl
} from 'react-router'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { PublicErrorBoundary } from '../app/components/errors'
import { EMBED_RESPONSE_HEADERS } from '../app/lib/domain/embed/embed-response-headers'
import routes from '../app/routes'
import { meta as docsNotFoundMeta } from '../app/routes/docs/docs-not-found'
import {
	action as embedAction,
	headers as embedHeaders,
	loader as embedLoader
} from '../app/routes/embed-page/embed-not-found'
import { meta as newsRoomArticleMeta } from '../app/routes/news-room-page/news-room-article-page'
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

/*
  The two sections that answer their own 404 inside their layout. A leaf with
  no meta inherits its parent's, which marks the miss indexable and canonical,
  so each one has to say otherwise itself.
*/
describe('section 404s', () => {
	it.each([
		['an unknown docs page', () => docsNotFoundMeta()],
		[
			'an unknown newsroom article',
			() => newsRoomArticleMeta({ loaderData: undefined } as never)
		]
	])('keep %s out of the index, with no canonical', (_, build) => {
		const tags = JSON.stringify(build())
		expect(tags).toContain('noindex, nofollow')
		expect(tags).not.toContain('canonical')
	})
})

/*
  A route that owns a boundary renders the meta of the matches up to it, the
  nearest one that exports `meta` winning. If that is not root's (which
  answers an error), it has to answer the error itself, or a 500 on /pricing
  ships with `index` and a canonical. Walked over the real route tree, so a
  route added tomorrow is checked without anyone listing it here, and a
  boundary route with no meta is held to whichever ancestor's meta it inherits.
*/
describe('routes that own the public boundary', () => {
	const appDir = join(dirname(fileURLToPath(import.meta.url)), '../app')
	const OWNS_PUBLIC_BOUNDARY =
		/PublicErrorBoundary as ErrorBoundary|ErrorBoundary\s*=\s*PublicErrorBoundary/

	type RouteEntry = { file: string; children?: RouteEntry[] }

	// Each boundary-owning route with its ancestors, nearest first. Root is
	// not in the config, which is right: its meta answers errors.
	function owners(entries: RouteEntry[], ancestors: string[] = []) {
		return entries.flatMap((entry): string[][] => {
			const chain = [entry.file, ...ancestors]
			const source = readFileSync(join(appDir, entry.file), 'utf8')
			return [
				...(OWNS_PUBLIC_BOUNDARY.test(source) ? [chain] : []),
				...owners(entry.children ?? [], chain)
			]
		})
	}

	const chains = owners(routes as unknown as RouteEntry[])

	/*
	  Some of these import a module that builds the db client on load. It
	  connects lazily, so an address that is never dialled is enough.
	*/
	beforeAll(() => {
		vi.stubEnv('DATABASE_URL', 'postgresql://unused:unused@127.0.0.1:1/unused')
	})
	afterAll(() => {
		vi.unstubAllEnvs()
	})

	it('are found', () => {
		expect(chains.length).toBeGreaterThan(5)
	})

	it.each(chains.map((chain) => [chain[0], chain]))(
		'%s keeps an error out of the index',
		async (_, chain) => {
			let routeMeta: ((args: unknown) => unknown) | undefined
			for (const file of chain) {
				routeMeta = (
					(await import(join(appDir, file))) as {
						meta?: (args: unknown) => unknown
					}
				).meta
				if (routeMeta) break
			}
			// Nothing below root exports meta: root's error branch answers.
			if (!routeMeta) return

			for (const error of [
				new ErrorResponseImpl(404, 'Not Found', null),
				new Error('boom')
			]) {
				const tags = JSON.stringify(
					routeMeta({
						error,
						location: { pathname: '/x' },
						params: {},
						matches: [],
						loaderData: undefined,
						data: undefined
					})
				)
				expect(tags).toContain('noindex, nofollow')
				expect(tags).not.toContain('canonical')
			}
		}
	)
})
