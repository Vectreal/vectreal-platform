import { ApiResponse } from '@shared/utils'

import { validatePreviewApiKeyForProject } from './preview-api-key-auth.server'
import { getAuthUser } from '../../http/auth.server'
import { withNoStore } from '../../http/response-headers.server'
import { hasPreviewTokenCredential } from '../embed/embed-access-policy'
import { getProject } from '../project/project-repository.server'

/**
 * Who is asking for a scene preview: an API key holder for this project, or a
 * signed-in user who can open it. Anything else is a `no-store` refusal, and a
 * caller with no right to the project is told the scene does not exist rather
 * than that it is forbidden, so the endpoint cannot be used to probe for ids.
 */
export async function authorizePreviewRequest(
	request: Request,
	projectId: string
) {
	const hasTokenCredential = hasPreviewTokenCredential(request)

	if (hasTokenCredential) {
		const validation = await validatePreviewApiKeyForProject({
			request,
			projectId
		})

		if (!validation.ok) {
			if (validation.error === 'rate_limited') {
				return withNoStore(ApiResponse.error('Too many requests', 429))
			}
			if (validation.error === 'domain_not_allowed') {
				return withNoStore(ApiResponse.forbidden('Forbidden'))
			}

			return withNoStore(ApiResponse.notFound('Scene not found'))
		}

		return { mode: 'apiKey' as const, userId: null }
	}

	const sessionAuth = await getAuthUser(request)
	if (sessionAuth instanceof Response) {
		return withNoStore(ApiResponse.notFound('Scene not found'))
	}

	const project = await getProject(projectId, sessionAuth.user.id)
	if (!project) {
		return withNoStore(ApiResponse.notFound('Scene not found'))
	}

	return {
		mode: 'session' as const,
		userId: sessionAuth.user.id,
		headers: sessionAuth.headers
	}
}
