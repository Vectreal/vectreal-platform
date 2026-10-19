import { resolveAgentActor, type AgentActor } from './agent-actor.server'
import { agentApiError } from './agent-api-response'
import { recordRateLimitAttempt } from '../../http/rate-limit.server'

import type { AgentScope } from './agent-scopes'
import type { RateLimitOptions } from '../../http/rate-limit.server'

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
 * The one way into an `/api/v1` route that acts for an agent. In order:
 *
 * 1. `resolveAgentActor`: the bearer token, its session and its grant;
 * 2. the grant's rate limit, counted before the scope so a caller probing
 *    for scopes spends budget too;
 * 3. the scope the route needs, or `'any'` for a route every grant may call.
 *
 * Each refusal is thrown as a coded Response. What the actor may then do to a
 * given resource is still the route's call: its role, through the dashboard
 * operation table.
 */
export async function authorizeAgentRequest(
	request: Request,
	{ scope }: { scope: AgentScope | 'any' }
): Promise<AgentActor> {
	const actor = await resolveAgentActor(request)

	const limit = recordRateLimitAttempt(request, {
		...AGENT_API_RATE_LIMIT,
		keyParts: [actor.grantId]
	})
	if (limit.limited) {
		throw agentApiError(
			429,
			'rate_limited',
			`Too many requests from this agent. Retry in ${limit.retryAfterSeconds}s.`,
			{ headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
		)
	}

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
