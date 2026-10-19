import { agentAuditEvents } from '../../../db/schema/auth/agent-audit-events'

import type { AgentActor } from './agent-actor.server'
import type { DbTransaction } from '../../../db/client'
import type { DashboardOperation } from '../dashboard/dashboard-operations'

/**
 * Records a change an agent made, in the transaction that made it, so a
 * change never lands without its row and a row never outlives a rolled-back
 * change.
 */
export async function recordAgentAudit(
	tx: DbTransaction,
	actor: AgentActor,
	operation: DashboardOperation,
	targetId: string
): Promise<void> {
	await tx.insert(agentAuditEvents).values({
		grantId: actor.grantId,
		oauthClientId: actor.clientId,
		userId: actor.userId,
		organizationId: actor.organizationId,
		operation,
		targetId
	})
}
