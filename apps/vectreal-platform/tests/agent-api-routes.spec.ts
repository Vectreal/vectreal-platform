/**
 * The `/api/v1` request pipeline, held over every registered v1 route.
 *
 * A request passes the layout's envelope middleware and then the route's
 * `agentGate`, and only then reaches a handler. The gate checks the token
 * before it reads the method, rate-limits, enforces the scope the route
 * declared for that method, answers any undeclared method 405, and leaves
 * the actor in context. Handlers never authorize anything themselves.
 *
 * Behavioral rather than textual: each route's real middleware chain runs
 * with only the token resolver replaced, and what each method needs is read
 * back from what the chain does. The routes come from the real config, so a
 * route is held to this by being registered, however it is written there.
 */
import { join } from 'node:path'

import { apiFailureSchema } from '@vctrl/sdk'
import { RouterContextProvider } from 'react-router'
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest'

import { agentActorFrom } from '../app/lib/domain/agent/agent-actor-context'
import { agentApiEnvelopeMiddleware } from '../app/lib/domain/agent/agent-api-envelope'
import { agentApiError } from '../app/lib/domain/agent/agent-api-response'
import { __resetRateLimitsForTest } from '../app/lib/http/rate-limit.server'
import routes from '../app/routes'

import type { AgentActor } from '../app/lib/domain/agent/agent-actor.server'
import type { RouteConfigEntry } from '@react-router/dev/routes'

const resolveAgentActor = vi.hoisted(() => vi.fn())

vi.mock('../app/lib/domain/agent/agent-actor.server', () => ({
	resolveAgentActor
}))

/**
 * What every gated v1 route lets each method do, and nothing else. A method
 * absent here must be answered 405. Changing what a route accepts means
 * changing this table, which is the point: it is the agent API's surface.
 */
const ACCESS: Record<string, Record<string, string>> = {
	'/api/v1/me': { GET: 'any' },
	'/api/v1/projects': { GET: 'projects:read', POST: 'projects:write' },
	'/api/v1/projects/:projectid/scenes': {
		GET: 'projects:read',
		POST: 'projects:write'
	},
	'/api/v1/projects/:projectid/embed-keys': {
		GET: 'embed:manage',
		POST: 'embed:manage'
	},
	'/api/v1/projects/:projectid/allowed-domains': {
		GET: 'embed:manage',
		PUT: 'embed:manage'
	},
	'/api/v1/scenes/:sceneid/publication': {
		POST: 'scenes:publish',
		DELETE: 'scenes:publish'
	},
	'/api/v1/scenes/:sceneid/embed': { GET: 'embed:manage' },
	'/api/v1/scenes/:sceneid/settings': {
		GET: 'projects:read',
		PATCH: 'scenes:write'
	},
	'/api/v1/session': { DELETE: 'any' }
}

const PUBLIC_ROUTES = new Set([
	// Public by design: the CLI asks it before it has a token.
	'/api/v1/cli/client',
	// Serves nothing: a path no route answers, coded 404 by the layout.
	'/api/v1/*'
])

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const NO_TOKEN = agentApiError(401, 'invalid_token', 'No token')

const actorWith = (scopes: string[]) =>
	({
		userId: 'user-1',
		email: null,
		clientId: 'client-1',
		grantId: `grant-${scopes.join('+') || 'none'}`,
		organizationId: 'org-1',
		organizationName: 'Acme',
		role: 'owner',
		scopes
	}) as AgentActor

const EVERY_SCOPE = actorWith([
	'projects:read',
	'projects:write',
	'scenes:write',
	'scenes:publish',
	'embed:manage'
])

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

type Middleware = (
	args: { request: Request; context: RouterContextProvider },
	next: () => Promise<Response>
) => Promise<Response | undefined>

async function chainOf({ file, ancestors }: ServedRoute) {
	const owners = await Promise.all([...ancestors, file].map(importRoute))
	return owners.flatMap(({ middleware }) => (middleware ?? []) as Middleware[])
}

/**
 * The chain as React Router runs it, ending in a handler that records the
 * actor it was given.
 */
async function run(route: ServedRoute, method: string) {
	const chain = await chainOf(route)
	const reached: AgentActor[] = []
	const context = new RouterContextProvider()
	const request = new Request(`https://vectreal.com${route.path}`, {
		method,
		headers: { Authorization: 'Bearer a.b.c' }
	})

	const call = async (index: number): Promise<Response> => {
		const middleware = chain[index]
		if (!middleware) {
			reached.push(agentActorFrom(context))
			return Response.json({ success: true, data: {} })
		}
		return (await middleware({ request, context }, () =>
			call(index + 1)
		)) as Response
	}

	return { response: await call(0), reached }
}

/** What the chain does with a method: who may make it, or that it is refused. */
async function accessFor(route: ServedRoute, method: string) {
	resolveAgentActor.mockResolvedValue(EVERY_SCOPE)
	const full = await run(route, method)
	if (full.response.status === 405) return null
	expect(full.reached, `${route.path} ${method}`).toEqual([EVERY_SCOPE])

	resolveAgentActor.mockResolvedValue(actorWith([]))
	const bare = await run(route, method)
	if (bare.reached.length) return 'any'

	const refusal = apiFailureSchema.parse(await bare.response.json())
	expect(refusal.code).toBe('insufficient_scope')
	return refusal.scope as string
}

beforeAll(() => {
	// Module scope builds a client; nothing here reaches a query.
	vi.stubEnv('DATABASE_URL', 'postgresql://gate:gate@127.0.0.1:1/gate')
})

beforeEach(() => {
	__resetRateLimitsForTest()
	resolveAgentActor.mockReset()
})

afterEach(() => {
	__resetRateLimitsForTest()
})

describe('agent API routes', () => {
	it('finds the registered v1 routes', () => {
		expect(v1Routes.map((route) => route.path).sort()).toEqual(
			[...Object.keys(ACCESS), ...PUBLIC_ROUTES].sort()
		)
	})

	it.each(v1Routes)(
		'$path answers its refusals in the coded envelope',
		async ({ path, ancestors }) => {
			const middleware = await Promise.all(
				ancestors.map(async (owner) => (await importRoute(owner)).middleware)
			)
			expect(middleware.flat(), path).toContain(agentApiEnvelopeMiddleware)
		}
	)

	it.each(gated)(
		'$path answers a caller without a token before reading the method',
		async (route) => {
			resolveAgentActor.mockRejectedValue(NO_TOKEN)

			for (const method of METHODS) {
				const { response, reached } = await run(route, method)
				expect(response, `${route.path} ${method}`).toBe(NO_TOKEN)
				expect(reached, `${route.path} ${method}`).toEqual([])
			}
		}
	)

	it.each(gated)(
		'$path lets each method do what the table says, and no more',
		async (route) => {
			const observed: Record<string, string> = {}
			for (const method of METHODS) {
				const scope = await accessFor(route, method)
				if (scope) observed[method] = scope
			}
			expect(observed).toEqual(ACCESS[route.path])
		}
	)

	it.each(gated)(
		'$path answers an undeclared method 405, naming the ones it takes',
		async (route) => {
			const declared = Object.keys(ACCESS[route.path])
			const undeclared = METHODS.filter((method) => !declared.includes(method))
			resolveAgentActor.mockResolvedValue(EVERY_SCOPE)

			for (const method of undeclared) {
				const { response, reached } = await run(route, method)
				expect(response.status, `${route.path} ${method}`).toBe(405)
				expect(response.headers.get('Allow')).toBe(declared.join(', '))
				expect(apiFailureSchema.parse(await response.json()).code).toBe(
					'method_not_allowed'
				)
				expect(reached).toEqual([])
			}
		}
	)

	it.each(gated)(
		'$path runs no other middleware ahead of its handlers',
		async (route) => {
			const ancestorMiddleware = (
				await Promise.all(route.ancestors.map(importRoute))
			).flatMap(({ middleware }) => middleware ?? [])
			// Only the envelope, which acts on the response `next()` returns.
			expect(ancestorMiddleware).toEqual([agentApiEnvelopeMiddleware])
			// And the gate, alone: nothing of the route's runs before it.
			expect((await importRoute(route.file)).middleware).toHaveLength(1)
		}
	)
})
