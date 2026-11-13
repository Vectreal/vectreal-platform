import { agentActorContext } from './agent-actor-context'
import { resolveAgentActor, type AgentActor } from './agent-actor.server'
import { agentApiError } from './agent-api-response'
import {
	checkRateLimit,
	recordRateLimitAttempt
} from '../../http/rate-limit.server'

import type { AgentScope } from './agent-scopes'
import type { RateLimitOptions } from '../../http/rate-limit.server'
import type { MiddlewareFunction } from 'react-router'

/**
 * Per grant, not per address: a grant is one user's approval of one client
 * in one organization, resolved by the server, so the caller cannot rotate
 * it. Per process, like every limit here; the cross-instance ceiling belongs
 * at the edge.
 */
export const AGENT_API_RATE_LIMIT = {
	bucket: 'agent-api',
	maxRequests: 120,
	windowMs: 60_000,
	includeClientIp: false
} as const satisfies Omit<RateLimitOptions, 'keyParts'>

/**
 * Per address, and counting refused tokens only: before a token resolves
 * there is no grant to key on, and every refusal costs a JWKS check, an Auth
 * lookup or a grant query. Counting only refusals keeps one office NAT from
 * pooling the agents behind it, the way the embed key check does.
 */
export const AGENT_TOKEN_REFUSAL_LIMIT = {
	bucket: 'agent-api-refused-token',
	maxRequests: 30,
	windowMs: 60_000
} as const satisfies Omit<RateLimitOptions, 'keyParts'>

function rateLimited(from: string, retryAfterSeconds: number): Response {
	return agentApiError(
		429,
		'rate_limited',
		`Too many requests from ${from}. Retry in ${retryAfterSeconds}s.`,
		{ headers: { 'Retry-After': String(retryAfterSeconds) } }
	)
}

/**
 * How a request becomes an actor, in order:
 *
 * 1. the caller's address still has budget for refused tokens;
 * 2. `resolveAgentActor`: the bearer token, its session and its grant (a
 *    refusal here spends the address's budget);
 * 3. the grant's rate limit, counted before the scope so a caller probing
 *    for scopes spends budget too;
 * 4. the scope asked for, or `'any'` for a request every grant may make.
 *
 * Each refusal is thrown as a coded Response. Routes never call this: they
 * declare their access with `agentGate`, which does.
 */
export async function authorizeAgentRequest(
	request: Request,
	{ scope }: { scope: AgentScope | 'any' }
): Promise<AgentActor> {
	const refused = checkRateLimit(request, AGENT_TOKEN_REFUSAL_LIMIT)
	if (refused.limited) {
		throw rateLimited(
			'this address with invalid tokens',
			refused.retryAfterSeconds
		)
	}

	const actor = await resolveAgentActor(request).catch((error: unknown) => {
		if (error instanceof Response) {
			recordRateLimitAttempt(request, AGENT_TOKEN_REFUSAL_LIMIT)
		}
		throw error
	})

	const limit = recordRateLimitAttempt(request, {
		...AGENT_API_RATE_LIMIT,
		keyParts: [actor.grantId]
	})
	if (limit.limited) throw rateLimited('this agent', limit.retryAfterSeconds)

	if (scope !== 'any' && !actor.scopes.includes(scope)) {
		// RFC 6750 §3.1, which MCP clients read to ask the user for more.
		throw agentApiError(
			403,
			'insufficient_scope',
			`This agent was not granted ${scope}`,
			{
				headers: {
					'WWW-Authenticate': `Bearer error="insufficient_scope", scope="${scope}"`
				},
				extra: { scope }
			}
		)
	}

	return actor
}

type AgentMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** What each method of a route needs; a method left out is answered 405. */
export type AgentRouteAccess = Partial<Record<AgentMethod, AgentScope | 'any'>>

/**
 * The one way into an `/api/v1` route that acts for an agent: its only
 * middleware, built from the scope each method needs.
 *
 * The token is checked before the method is read, so a caller without one
 * learns nothing about the route, and a method the route does not declare is
 * answered 405 with `Allow` listing those it does. React Router's own 405 for
 * a missing handler never runs, because nothing undeclared reaches a handler.
 * What the actor may then do to a given resource is still the handler's call:
 * its role, through the dashboard operation table.
 */
export function agentGate(
	access: AgentRouteAccess
): MiddlewareFunction<Response> {
	const methods = Object.keys(access) as AgentMethod[]
	const answers =
		methods.length > 1
			? `${methods.slice(0, -1).join(', ')} and ${methods.at(-1)}`
			: methods[0]

	return async ({ request, context }, next) => {
		// React Router answers HEAD with the loader.
		const method = request.method === 'HEAD' ? 'GET' : request.method
		const scope = access[method as AgentMethod]

		let actor: AgentActor
		try {
			actor = await authorizeAgentRequest(request, { scope: scope ?? 'any' })
		} catch (error) {
			if (error instanceof Response) return error
			throw error
		}

		if (!scope) {
			return agentApiError(
				405,
				'method_not_allowed',
				`This route answers ${answers}.`,
				{ headers: { Allow: methods.join(', ') } }
			)
		}

		context.set(agentActorContext, actor)
		return next()
	}
}
