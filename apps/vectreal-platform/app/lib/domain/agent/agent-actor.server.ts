import { ApiResponse } from '@shared/utils'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { evaluateAgentClaims, readBearerToken } from './agent-bearer'
import { findAgentGrantForMember } from './agent-grant-repository.server'

import type { AgentScope } from './agent-scopes'
import type { MembershipRole } from '../dashboard/dashboard-operations'

export interface AgentActor {
	userId: string
	email: string | null
	clientId: string
	grantId: string
	organizationId: string
	organizationName: string
	role: MembershipRole
	scopes: AgentScope[]
}

/*
  One client for every agent request, so the JWKS `getClaims` fetches is cached
  across them. It holds the publishable key only: verifying a token needs no
  secret, and this client never acts as anyone.
*/
let verifier: SupabaseClient | undefined

function getVerifier(): SupabaseClient {
	if (!verifier) {
		if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
			throw new Error(
				'Missing required environment variables: SUPABASE_URL and SUPABASE_KEY must be set'
			)
		}
		verifier = createClient(
			process.env.SUPABASE_URL,
			process.env.SUPABASE_KEY,
			{
				auth: { autoRefreshToken: false, persistSession: false }
			}
		)
	}
	return verifier
}

/*
  The token is attacker input, and `getClaims` only reports Auth's own errors:
  it parses the token with `JSON.parse` and rethrows anything else, so a
  well-shaped but undecodable token would surface as a 500. Every failure to
  verify is the same answer here, an invalid token.
*/
async function verifyClaims(
	auth: SupabaseClient['auth'],
	token: string
): Promise<Record<string, unknown> | null> {
	try {
		const { data, error } = await auth.getClaims(token)
		return error || !data ? null : data.claims
	} catch {
		return null
	}
}

/** RFC 6750: a client reads this and signs in again. */
function invalidToken(): Response {
	return ApiResponse.unauthorized('Invalid or expired agent token', {
		headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' }
	})
}

/**
 * The one place an agent request's bearer token becomes an actor. Every
 * `/api/v1` route starts here; none reads a cookie.
 *
 * In order, each refusal thrown as a Response:
 * 1. the token comes from `Authorization` alone (a session cookie beside it is
 *    a 400, so no route can act on whichever credential it read first);
 * 2. its signature and expiry verify against this project's JWKS;
 * 3. it was issued to an OAuth client, for the agent audience;
 * 4. Auth still knows its session: revoking a grant deletes the session, and
 *    the JWT alone would keep verifying for up to an hour;
 * 5. the user granted this client an organization they still belong to.
 *
 * What the actor may then do is the intersection of its scopes and its role,
 * decided per route.
 */
export async function resolveAgentActor(request: Request): Promise<AgentActor> {
	const bearer = readBearerToken(request)
	if (!bearer.ok) {
		throw bearer.reason === 'mixed'
			? ApiResponse.badRequest(
					'Send either an agent token or a session cookie, not both'
				)
			: invalidToken()
	}

	const auth = getVerifier().auth
	const verified = await verifyClaims(auth, bearer.token)
	if (!verified) {
		throw invalidToken()
	}

	const claims = evaluateAgentClaims(verified)
	if (!claims.ok) {
		throw invalidToken()
	}

	const live = await auth.getUser(bearer.token)
	if (live.error || !live.data.user) {
		throw invalidToken()
	}

	const grant = await findAgentGrantForMember(claims.userId, claims.clientId)
	if (!grant) {
		throw invalidToken()
	}

	return {
		userId: claims.userId,
		email: live.data.user.email ?? null,
		clientId: claims.clientId,
		grantId: grant.id,
		organizationId: grant.organizationId,
		organizationName: grant.organizationName,
		role: grant.role,
		scopes: grant.scopes
	}
}
