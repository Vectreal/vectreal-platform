/**
 * GET /api/v1/projects/:projectId/allowed-domains  the sites that may show
 *                                                  the project's embeds.
 * PUT /api/v1/projects/:projectId/allowed-domains  replaces them from
 *                                                  `{ "domains": ["…"] }`.
 *                                                  Needs an `Idempotency-Key`.
 *
 * Both need `embed:manage` and answer `{ allowedDomains }`, as stored: exact
 * hosts or a leading wildcard such as `*.myshopify.com`, normalized and
 * without duplicates. An empty list refuses the embed on every customer site.
 */

import { ApiResponse } from '@shared/utils'
import { setAllowedDomainsInputSchema } from '@vctrl/sdk'

import { agentApiError } from '../../../lib/domain/agent/agent-api-response'
import { recordAgentAudit } from '../../../lib/domain/agent/agent-audit.server'
import { withIdempotency } from '../../../lib/domain/agent/agent-idempotency.server'
import { AGENT_OPERATION_SCOPES } from '../../../lib/domain/agent/agent-operation-scopes'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { resolveAgentProject } from '../../../lib/domain/agent/agent-resource.server'
import {
	parseAllowedDomainPatterns,
	validateAllowedDomainInput
} from '../../../lib/domain/embed/embed-domain-policy'
import {
	getProject,
	updateProject
} from '../../../lib/domain/project/project-repository.server'

import type { Route } from './+types/projects.$projectId.allowed-domains'
import type { AllowedDomains } from '@vctrl/sdk'

const OPERATION = 'project-embed-domains:update'

export async function loader({ request, params }: Route.LoaderArgs) {
	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES[OPERATION]
	})
	const { projectId } = await resolveAgentProject(
		params.projectId,
		actor,
		OPERATION
	)

	const project = await getProject(projectId, actor.userId)
	if (!project) throw agentApiError(404, 'not_found', 'No such project.')

	return domainsResponse(
		parseAllowedDomainPatterns(project.allowedEmbedDomains)
	)
}

export async function action({ request, params }: Route.ActionArgs) {
	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES[OPERATION]
	})
	if (request.method !== 'PUT') {
		return agentApiError(
			405,
			'method_not_allowed',
			'This route answers GET and PUT.',
			{ headers: { Allow: 'GET, PUT' } }
		)
	}

	const { projectId } = await resolveAgentProject(
		params.projectId,
		actor,
		OPERATION
	)

	const payload: unknown = await request.json().catch(() => undefined)
	const input = setAllowedDomainsInputSchema.safeParse(payload)
	if (!input.success) {
		throw agentApiError(
			400,
			'invalid_request',
			'Send a JSON body like {"domains": ["example.com", "*.myshopify.com"]}.',
			{ extra: { issues: input.error.issues } }
		)
	}
	// The dashboard's rule, read from the same text the edit page submits.
	const validation = validateAllowedDomainInput(input.data.domains.join('\n'))
	if (!validation.ok) {
		throw agentApiError(400, 'invalid_request', validation.message)
	}
	const { patterns } = validation

	return withIdempotency(
		{ grantId: actor.grantId, request, payload: { projectId, patterns } },
		async (tx) => {
			await updateProject(
				projectId,
				{
					allowedEmbedDomains: patterns.length > 0 ? patterns.join('\n') : null
				},
				actor.userId,
				tx
			)
			await recordAgentAudit(tx, actor, OPERATION, projectId)
			return domainsResponse(patterns)
		}
	)
}

function domainsResponse(allowedDomains: string[]): Response {
	return ApiResponse.success({ allowedDomains } satisfies AllowedDomains, 200, {
		headers: { 'Cache-Control': 'no-store' }
	})
}
