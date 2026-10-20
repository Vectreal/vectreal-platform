/**
 * DELETE /api/v1/session
 *
 * Ends the session the bearer token belongs to: `vectreal logout`. The token
 * and its refresh token stop working; the agent's grant stays, so signing in
 * again needs no new consent. Revoking the agent is the dashboard's
 * Connected agents page.
 *
 * The server ends it, not the CLI: Supabase Auth's own logout wants the
 * project's publishable key, which the app never hands out, and the key would
 * let anyone call Auth around the app's sign-up checks.
 */

import { ApiResponse } from '@shared/utils'

import { agentApiError } from '../../../lib/domain/agent/agent-api-response'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { endAgentSession } from '../../../lib/domain/agent/agent-session.server'

import type { Route } from './+types/session'
import type { EndedSession } from '@vctrl/sdk'

export async function loader({ request }: Route.LoaderArgs) {
	await authorizeAgentRequest(request, { scope: 'any' })
	return methodNotAllowed()
}

export async function action({ request }: Route.ActionArgs) {
	await authorizeAgentRequest(request, { scope: 'any' })
	if (request.method !== 'DELETE') return methodNotAllowed()

	await endAgentSession(request)

	return ApiResponse.success({ signedOut: true } satisfies EndedSession, 200, {
		headers: { 'Cache-Control': 'no-store' }
	})
}

function methodNotAllowed(): Response {
	return agentApiError(
		405,
		'method_not_allowed',
		'This route answers DELETE.',
		{
			headers: { Allow: 'DELETE' }
		}
	)
}
