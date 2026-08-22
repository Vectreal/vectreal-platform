/**
 * The embed panel's view of one project's API keys.
 *
 * The panel is mounted from two places with very different data plumbing - the
 * dashboard scene route's loader already holds the project row, while the
 * publisher would need a four-file thread-through to reach it - so the panel
 * fetches for itself against this route rather than either mount site growing
 * props it cannot supply.
 *
 * No plaintext key is ever read back here. `createApiKey` returns one exactly
 * once, on creation, and that response is the only place it appears.
 */

import { ApiResponse } from '@shared/utils'

import {
	createApiKey,
	getAllUserApiKeys
} from '../../lib/domain/auth/api-key-repository.server'
import { QuotaExceededError } from '../../lib/domain/billing/quota-exceeded-error'
import { canPerformDashboardOperation } from '../../lib/domain/dashboard/dashboard-operations'
import { resolveProjectMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
import { parseAllowedDomainPatterns } from '../../lib/domain/embed/embed-domain-policy'
import { toEmbedApiKeyOptions } from '../../lib/domain/embed/embed-key-options'
import { getProject } from '../../lib/domain/project/project-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { ensurePost } from '../../lib/http/requests.server'

import type { EmbedApiKeyOption } from '../../lib/domain/embed/embed-key-options'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

/** Matches the 90-day default the full API key form offers. */
const DEFAULT_EXPIRY_DAYS = 90

export interface EmbedApiKeysPayload {
	projectId: string
	projectName: string
	allowedDomains: string[]
	keys: EmbedApiKeyOption[]
	canCreateKey: boolean
}

export interface EmbedApiKeyCreatedPayload {
	key: EmbedApiKeyOption
	/** The only time this value is ever sent. Not persisted in the clear. */
	plaintext: string
}

async function resolveProjectAccess(request: Request, projectId?: string) {
	if (!projectId) {
		return { error: ApiResponse.badRequest('Missing project id') } as const
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return { error: authResult } as const
	}

	const headers = new Headers(authResult.headers)
	const membership = await resolveProjectMembership(
		projectId,
		authResult.user.id
	)

	// A project the actor is not a member of is reported as missing rather than
	// forbidden, so this route cannot be used to probe which ids exist.
	if (!membership) {
		return {
			error: ApiResponse.notFound('Project not found', { headers })
		} as const
	}

	return { userId: authResult.user.id, headers, membership } as const
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const access = await resolveProjectAccess(request, params.projectId)
	if ('error' in access) {
		return access.error
	}

	const { userId, headers, membership } = access

	if (!canPerformDashboardOperation('api-key:read', membership)) {
		return ApiResponse.forbidden(
			'You do not have permission to view API keys',
			{ headers }
		)
	}

	const [project, allKeys] = await Promise.all([
		getProject(membership.projectId, userId),
		getAllUserApiKeys(userId)
	])

	if (!project) {
		return ApiResponse.notFound('Project not found', { headers })
	}

	const payload: EmbedApiKeysPayload = {
		projectId: project.id,
		projectName: project.name,
		allowedDomains: parseAllowedDomainPatterns(project.allowedEmbedDomains),
		keys: toEmbedApiKeyOptions(allKeys, project.id, new Date()),
		canCreateKey: canPerformDashboardOperation('api-key:create', membership)
	}

	return ApiResponse.success(payload, 200, { headers })
}

export async function action({ request, params }: ActionFunctionArgs) {
	const methodCheck = ensurePost(request)
	if (methodCheck) {
		return methodCheck
	}

	const formData = await request.formData()

	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	if (formData.get('intent') !== 'create') {
		return ApiResponse.badRequest('Unsupported intent')
	}

	const access = await resolveProjectAccess(request, params.projectId)
	if ('error' in access) {
		return access.error
	}

	const { userId, headers, membership } = access

	if (!canPerformDashboardOperation('api-key:create', membership)) {
		return ApiResponse.forbidden(
			'You do not have permission to create API keys',
			{ headers }
		)
	}

	const project = await getProject(membership.projectId, userId)
	if (!project) {
		return ApiResponse.notFound('Project not found', { headers })
	}

	const expiresAt = new Date()
	expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS)

	try {
		// `createApiKey` re-checks admin access and the per-org quota itself; the
		// check above is what turns a thrown error into a 403 the panel can render.
		const created = await createApiKey({
			userId,
			organizationId: membership.organizationId,
			name: `Embed key for ${project.name}`,
			description: 'Created from the scene embed panel.',
			projectIds: [project.id],
			expiresAt
		})

		const [option] = toEmbedApiKeyOptions(
			[{ apiKey: created.apiKey, projects: [{ id: project.id }] }],
			project.id,
			new Date()
		)

		const payload: EmbedApiKeyCreatedPayload = {
			key: option,
			plaintext: created.plaintext
		}

		return ApiResponse.created(payload, { headers })
	} catch (error) {
		if (error instanceof QuotaExceededError) {
			return ApiResponse.quotaExceeded(error.message, {
				limitKey: error.limitKey,
				currentValue: error.currentValue,
				limit: error.limit,
				plan: error.plan,
				upgradeTo: error.upgradeTo
			})
		}

		return ApiResponse.badRequest(
			error instanceof Error ? error.message : 'Could not create an API key'
		)
	}
}
