/**
 * GET /api/v1/me
 *
 * Who an agent token acts as: the user, the organization the grant names and
 * the user's role in it, the client, the granted scopes, and the plan. The
 * CLI's `whoami` and every agent's first call.
 *
 * Plan and billing state, never limits: most configured limits are not
 * enforced, and an agent would read them as promises.
 */

import { ApiResponse } from '@shared/utils'

import { agentActorFrom } from '../../../lib/domain/agent/agent-actor-context'
import { agentGate } from '../../../lib/domain/agent/agent-request.server'
import { getOrgSubscription } from '../../../lib/domain/billing/entitlement-service.server'

import type { Route } from './+types/me'
import type { Me } from '@vctrl/sdk'

export const middleware = [
	agentGate({
		GET: 'any'
	})
]

export async function loader({ context }: Route.LoaderArgs) {
	const actor = agentActorFrom(context)

	const subscription = await getOrgSubscription(actor.organizationId)

	return ApiResponse.success(
		{
			user: { id: actor.userId, email: actor.email },
			organization: {
				id: actor.organizationId,
				name: actor.organizationName,
				role: actor.role
			},
			client: { id: actor.clientId },
			scopes: actor.scopes,
			plan: {
				plan: subscription.plan,
				billingState: subscription.billingState
			}
		} satisfies Me,
		200,
		{ headers: { 'Cache-Control': 'no-store' } }
	)
}
