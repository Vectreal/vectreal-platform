import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { agentGrants } from '../../../db/schema/auth/agent-grants'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'

import type { AgentScope } from './agent-scopes'

const db = getDbClient()

export type AgentGrant = typeof agentGrants.$inferSelect

/** The organization named on a consent form is not one the user belongs to. */
export class AgentGrantOrganizationError extends Error {
	constructor() {
		super('Organization not found for this user')
		this.name = 'AgentGrantOrganizationError'
	}
}

/** Every client the user has approved, one row each. */
export async function listAgentGrants(userId: string): Promise<AgentGrant[]> {
	return db.select().from(agentGrants).where(eq(agentGrants.userId, userId))
}

/**
 * Record what the user approved for one OAuth client. Approving the same
 * client again replaces the organization and scopes, because the consent page
 * shows the full choice each time and the latest one is what the user meant.
 *
 * The membership check lives here, in the same transaction as the write, so
 * no caller can record a grant into an organization the user is not part of.
 * Role is deliberately not checked: what a member may do is decided per
 * request, as the intersection of these scopes and their role.
 */
export async function upsertAgentGrant(input: {
	userId: string
	organizationId: string
	oauthClientId: string
	scopes: readonly AgentScope[]
}): Promise<AgentGrant> {
	return db.transaction(async (tx) => {
		const [membership] = await tx
			.select({ role: organizationMemberships.role })
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.userId, input.userId),
					eq(organizationMemberships.organizationId, input.organizationId)
				)
			)
			.limit(1)

		if (!membership) {
			throw new AgentGrantOrganizationError()
		}

		const scopes = [...input.scopes]
		const [grant] = await tx
			.insert(agentGrants)
			.values({
				userId: input.userId,
				organizationId: input.organizationId,
				oauthClientId: input.oauthClientId,
				scopes
			})
			.onConflictDoUpdate({
				target: [agentGrants.userId, agentGrants.oauthClientId],
				set: {
					organizationId: input.organizationId,
					scopes,
					updatedAt: new Date()
				}
			})
			.returning()

		return grant
	})
}
