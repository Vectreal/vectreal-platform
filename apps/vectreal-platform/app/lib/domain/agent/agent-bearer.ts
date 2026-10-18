import { AGENT_TOKEN_AUDIENCE } from './agent-token-audience'
import { hasSupabaseAuthCookie } from '../../sessions/supabase-auth-cookie'

/*
  The pure half of the agent token check, kept apart from
  `agent-actor.server.ts` so it can be tested without a database or an Auth
  server. Nothing here verifies a signature: `evaluateAgentClaims` reads claims
  that `getClaims` has already verified.
*/

export type BearerRefusal = 'missing' | 'malformed' | 'mixed'

export type BearerResult =
	{ ok: true; token: string } | { ok: false; reason: BearerRefusal }

/**
 * The bearer token on an agent request, from the `Authorization` header only:
 * never a cookie and never a query string, which would reach request logs.
 *
 * A request that also carries a Supabase auth cookie is refused rather than
 * resolved either way, so no route can end up acting on whichever credential
 * it happened to read first.
 */
export function readBearerToken(request: Request): BearerResult {
	const header = request.headers.get('Authorization')
	if (!header || header.trim() === '') {
		return { ok: false, reason: 'missing' }
	}

	if (hasSupabaseAuthCookie(request.headers.get('Cookie'))) {
		return { ok: false, reason: 'mixed' }
	}

	const match = /^Bearer[ ]+(\S+)$/i.exec(header.trim())
	if (!match) {
		return { ok: false, reason: 'malformed' }
	}

	return { ok: true, token: match[1] }
}

export type AgentClaimsRefusal = 'audience' | 'client' | 'subject'

export type AgentClaimsResult =
	| { ok: true; userId: string; clientId: string }
	| { ok: false; reason: AgentClaimsRefusal }

/**
 * Whether verified claims belong to an agent token. A first-party session
 * token keeps the audience `authenticated` and carries no `client_id`, so a
 * session lifted from a browser cannot be replayed against the agent API.
 */
export function evaluateAgentClaims(
	claims: Record<string, unknown>
): AgentClaimsResult {
	const audience = claims.aud
	const audiences = Array.isArray(audience) ? audience : [audience]
	if (!audiences.includes(AGENT_TOKEN_AUDIENCE)) {
		return { ok: false, reason: 'audience' }
	}

	const clientId = claims.client_id
	if (typeof clientId !== 'string' || clientId === '') {
		return { ok: false, reason: 'client' }
	}

	const userId = claims.sub
	if (typeof userId !== 'string' || userId === '') {
		return { ok: false, reason: 'subject' }
	}

	return { ok: true, userId, clientId }
}
