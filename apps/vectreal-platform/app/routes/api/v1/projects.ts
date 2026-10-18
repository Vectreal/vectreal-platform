/**
 * GET /api/v1/projects
 *
 * The projects in the organization the agent's grant names, by name. Needs
 * `projects:read`, which every grant carries.
 */

import { ApiResponse } from '@shared/utils'

import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { listOrganizationProjects } from '../../../lib/domain/project/project-repository.server'

import type { Route } from './+types/projects'
import type { ProjectList } from '@vctrl/sdk'

export async function loader({ request }: Route.LoaderArgs) {
	const actor = await authorizeAgentRequest(request, { scope: 'projects:read' })

	const projects = await listOrganizationProjects(actor.organizationId)

	return ApiResponse.success({ projects } satisfies ProjectList, 200, {
		headers: { 'Cache-Control': 'no-store' }
	})
}
