/**
 * Every `/api/v1` route that acts for an agent enters through
 * `authorizeAgentRequest`, which holds it to the grant's rate limit and a
 * scope. A route calling `resolveAgentActor` itself type-checks and works, and
 * its own spec mocks whatever it imports, so nothing else would notice it
 * skipping both.
 *
 * Behavioral rather than textual: the gate is replaced by one that refuses,
 * and every loader and action each route module exports must answer with
 * that refusal before it does anything else. The routes come from the real
 * config, so a route is held to this by being registered, however it is
 * written there.
 */
import { join } from 'node:path'

import { beforeAll, describe, expect, it, vi } from 'vitest'

import routes from '../app/routes'

import type { RouteConfigEntry } from '@react-router/dev/routes'

const { authorizeAgentRequest, GATE_REFUSAL } = vi.hoisted(() => {
	const GATE_REFUSAL = new Response('gate', { status: 418 })
	return {
		GATE_REFUSAL,
		authorizeAgentRequest: vi.fn(async () => {
			throw GATE_REFUSAL
		})
	}
})

vi.mock('../app/lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest
}))

/** Public by design: the CLI asks it before it has a token. */
const PUBLIC_ROUTES = new Set(['/api/v1/cli/client'])

interface ServedRoute {
	path: string
	file: string
	/** The layouts and parents whose modules run on the way to this one. */
	ancestors: string[]
}

/** Every leaf route, under the path the router serves it at. */
function leafRoutes(
	entries: RouteConfigEntry[],
	parent = '',
	ancestors: string[] = []
): ServedRoute[] {
	return entries.flatMap((entry) => {
		const path = entry.path ? `${parent}/${entry.path}` : parent
		return entry.children?.length
			? leafRoutes(entry.children, path, [...ancestors, entry.file])
			: [{ path, file: entry.file, ancestors }]
	})
}

/** As the router matches it: case-insensitive, one slash between segments. */
const normalize = (path: string) =>
	`/${path.toLowerCase().split('/').filter(Boolean).join('/')}`

const v1Routes = leafRoutes(routes)
	.map((route) => ({ ...route, path: normalize(route.path) }))
	.filter(({ path }) => path === '/api/v1' || path.startsWith('/api/v1/'))
const gated = v1Routes.filter(({ path }) => !PUBLIC_ROUTES.has(path))

const importRoute = (file: string) =>
	import(join(import.meta.dirname, '../app', file))

beforeAll(() => {
	// Module scope builds a client; the gate refuses before any query runs.
	vi.stubEnv('DATABASE_URL', 'postgresql://gate:gate@127.0.0.1:1/gate')
})

describe('agent API routes', () => {
	it('finds the registered v1 routes', () => {
		expect(v1Routes.map((route) => route.path)).toEqual(
			expect.arrayContaining([
				'/api/v1/me',
				'/api/v1/projects',
				'/api/v1/cli/client'
			])
		)
	})

	it.each(gated)(
		'$path answers every export with the gate refusal',
		async ({ path, file, ancestors }) => {
			// Middleware runs before the loader, outside the gate, on this module
			// and every layout above it; a v1 request has nothing to do before it
			// knows who is asking.
			for (const owner of [...ancestors, file]) {
				const { middleware } = await importRoute(owner)
				expect(middleware, `${path}: middleware in ${owner}`).toBeUndefined()
			}

			const module = await importRoute(file)

			const handlers = (['loader', 'action'] as const).filter(
				(name) => typeof module[name] === 'function'
			)
			expect(handlers.length, path).toBeGreaterThan(0)

			for (const name of handlers) {
				authorizeAgentRequest.mockClear()
				const request = new Request(`https://vectreal.com${path}`, {
					method: name === 'loader' ? 'GET' : 'POST'
				})

				await expect(
					module[name]({ request, params: {}, context: {} }),
					`${path} ${name}`
				).rejects.toBe(GATE_REFUSAL)
				expect(authorizeAgentRequest, `${path} ${name}`).toHaveBeenCalledWith(
					request,
					expect.anything()
				)
			}
		}
	)
})
