/**
 * GET  /api/v1/projects  the projects in the grant's organization, by name.
 *                        Needs `projects:read`, which every grant carries.
 * POST /api/v1/projects  creates one there from `{ "name": "…" }`. Needs
 *                        `projects:write` and an `Idempotency-Key`; answers
 *                        201 `{ project: { id, name } }`.
 */

import { ApiResponse } from '@shared/utils'
import { createProjectInputSchema } from '@vctrl/sdk'

import {
	agentApiError,
	agentBillingRefusal
} from '../../../lib/domain/agent/agent-api-response'
import { recordAgentAudit } from '../../../lib/domain/agent/agent-audit.server'
import { withIdempotency } from '../../../lib/domain/agent/agent-idempotency.server'
import { AGENT_OPERATION_SCOPES } from '../../../lib/domain/agent/agent-operation-scopes'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import {
	canPerformDashboardOperation,
	describeDashboardOperationDenial
} from '../../../lib/domain/dashboard/dashboard-operations'
import {
	createProject,
	listOrganizationProjects
} from '../../../lib/domain/project/project-repository.server'

import type { Route } from './+types/projects'
import type { CreatedProject, ProjectList } from '@vctrl/sdk'

export async function loader({ request }: Route.LoaderArgs) {
	const actor = await authorizeAgentRequest(request, { scope: 'projects:read' })

	const projects = await listOrganizationProjects(actor.organizationId)

	return ApiResponse.success({ projects } satisfies ProjectList, 200, {
		headers: { 'Cache-Control': 'no-store' }
	})
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== 'POST') {
		return agentApiError(
			405,
			'method_not_allowed',
			'This route answers GET and POST.',
			{ headers: { Allow: 'GET, POST' } }
		)
	}

	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['project:create']
	})

	// The scope says what the agent may do; the role, what the user may.
	if (!canPerformDashboardOperation('project:create', { role: actor.role })) {
		throw agentApiError(
			403,
			'insufficient_role',
			describeDashboardOperationDenial('project:create', actor.role)
		)
	}

	const payload: unknown = await request.json().catch(() => undefined)
	const input = createProjectInputSchema.safeParse(payload)
	if (!input.success) {
		throw agentApiError(
			400,
			'invalid_request',
			'Send a JSON body like {"name": "Chairs"}, with a name of 3 to 100 characters.',
			{ extra: { issues: input.error.issues } }
		)
	}

	return withIdempotency(
		{ grantId: actor.grantId, request, payload: input.data },
		async (tx) => {
			try {
				const project = await createProject(
					actor.organizationId,
					input.data.name,
					actor.userId,
					tx
				)
				await recordAgentAudit(tx, actor, 'project:create', project.id)

				return ApiResponse.success(
					{
						project: { id: project.id, name: project.name }
					} satisfies CreatedProject,
					201,
					{ headers: { 'Cache-Control': 'no-store' } }
				)
			} catch (error) {
				const refusal = agentBillingRefusal(error, request)
				if (!refusal) throw error
				return refusal
			}
		}
	)
}
