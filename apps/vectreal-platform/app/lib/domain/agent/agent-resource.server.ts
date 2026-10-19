import { agentApiError } from './agent-api-response'
import { UUID_REGEX } from '../../../constants/utility-constants'
import {
	canPerformDashboardOperation,
	describeDashboardOperationDenial,
	type DashboardOperation
} from '../dashboard/dashboard-operations'
import {
	resolveProjectMembership,
	resolveSceneMembership,
	type ResolvedMembership
} from '../dashboard/dashboard-permissions.server'

import type { AgentActor } from './agent-actor.server'

/**
 * The project an agent names, and the user's membership in it.
 *
 * A malformed id, a project the user cannot see and one outside the grant's
 * organization all answer the same 404, so ids cannot be probed; a malformed
 * id would otherwise fail the uuid cast as a 500. Only then does the role
 * check answer 403.
 */
export async function resolveAgentProject(
	projectId: string | undefined,
	actor: AgentActor,
	operation: DashboardOperation
): Promise<ResolvedMembership> {
	const membership =
		projectId &&
		UUID_REGEX.test(projectId) &&
		(await resolveProjectMembership(projectId, actor.userId))
	if (!membership || membership.organizationId !== actor.organizationId) {
		throw agentApiError(404, 'not_found', 'No such project.')
	}
	assertAgentRole(operation, membership)
	return membership
}

/** The scene an agent names, under the same 404 and 403 rule. */
export async function resolveAgentScene(
	sceneId: string | undefined,
	actor: AgentActor,
	operation: DashboardOperation
): Promise<ResolvedMembership & { sceneId: string }> {
	const membership =
		sceneId &&
		UUID_REGEX.test(sceneId) &&
		(await resolveSceneMembership(sceneId, actor.userId))
	if (
		!sceneId ||
		!membership ||
		membership.organizationId !== actor.organizationId ||
		!membership.projectId
	) {
		throw agentApiError(404, 'not_found', 'No such scene.')
	}
	assertAgentRole(operation, membership)
	return { ...membership, sceneId }
}

function assertAgentRole(
	operation: DashboardOperation,
	membership: ResolvedMembership
): void {
	if (!canPerformDashboardOperation(operation, membership)) {
		throw agentApiError(
			403,
			'insufficient_role',
			describeDashboardOperationDenial(operation, membership.role)
		)
	}
}
