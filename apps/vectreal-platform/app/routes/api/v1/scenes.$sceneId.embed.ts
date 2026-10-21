/**
 * GET /api/v1/scenes/:sceneId/embed?keyId=  the embed for a published scene,
 *                                           ready to paste: the iframe URL
 *                                           and two snippets, token included.
 *
 * Needs `embed:manage`. Uses the key `keyId` names, or the project's best
 * usable key. The token is decrypted for this answer alone, as the dashboard's
 * embed panel does, and the answer is never kept or cached.
 */

import { ApiResponse } from '@shared/utils'

import { resolveDeploymentOrigin } from '../../../lib/deployment-origin'
import { agentApiError } from '../../../lib/domain/agent/agent-api-response'
import { AGENT_OPERATION_SCOPES } from '../../../lib/domain/agent/agent-operation-scopes'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { resolveAgentScene } from '../../../lib/domain/agent/agent-resource.server'
import { getAllUserApiKeys } from '../../../lib/domain/auth/api-key-repository.server'
import { resolveApiKeyValue } from '../../../lib/domain/auth/api-key-value.server'
import { parseAllowedDomainPatterns } from '../../../lib/domain/embed/embed-domain-policy'
import {
	isEmbedKeyUsable,
	toEmbedApiKeyOptions
} from '../../../lib/domain/embed/embed-key-options'
import {
	buildEmbedUrl,
	buildInternalPreviewPath,
	buildResponsiveEmbedSnippet,
	buildSdkEmbedSnippet
} from '../../../lib/domain/embed/embed-snippet'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import { sceneSettingsService } from '../../../lib/domain/scene/server/scene-settings-service.server'

import type { Route } from './+types/scenes.$sceneId.embed'
import type { SceneEmbed } from '@vctrl/sdk'

export async function loader({ request, params }: Route.LoaderArgs) {
	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['api-key:read']
	})
	const { sceneId, projectId } = await resolveAgentScene(
		params.sceneId,
		actor,
		'api-key:read'
	)

	// Matched against the project's keys in memory, never queried, so any
	// string is safe here and one that names no key is a 404 below.
	const keyId = new URL(request.url).searchParams.get('keyId')

	if (!(await sceneSettingsService.isScenePublished(sceneId))) {
		throw agentApiError(
			409,
			'scene_not_published',
			'The scene is a draft. Publish it first, then ask for its embed.'
		)
	}

	const now = new Date()
	const [project, keys] = await Promise.all([
		getProject(projectId, actor.userId),
		getAllUserApiKeys(actor.userId)
	])
	if (!project) throw agentApiError(404, 'not_found', 'No such scene.')

	const options = toEmbedApiKeyOptions(
		keys
			.filter((key) => key.projects.some((scoped) => scoped.id === projectId))
			.map((key) => {
				const resolved = resolveApiKeyValue(key.apiKey, now)
				return { ...key, value: resolved.readable ? resolved.value : null }
			}),
		projectId,
		now
	)

	// Usable keys sort first, so with no key named the first one is the best.
	const key = keyId
		? options.find((option) => option.id === keyId)
		: options.find(isEmbedKeyUsable)
	if (keyId && !key) {
		throw agentApiError(404, 'not_found', 'No such embed key.')
	}
	if (!key) {
		throw agentApiError(
			409,
			'embed_key_required',
			`The project has no embed key that works. Create one with POST /api/v1/projects/${projectId}/embed-keys.`,
			{ extra: { projectId } }
		)
	}
	if (!isEmbedKeyUsable(key) || key.value === null) {
		throw agentApiError(
			409,
			'embed_key_unusable',
			'That embed key is revoked, expired or cannot be read back. Use another, or create one.'
		)
	}

	// The deployment's own origin, never the request's Host: this URL is pasted
	// into customer pages.
	const origin = resolveDeploymentOrigin()
	const url = buildEmbedUrl({ origin, projectId, sceneId, token: key.value })

	return ApiResponse.success(
		{
			embed: {
				projectId,
				keyId: key.id,
				url,
				iframeSnippet: buildResponsiveEmbedSnippet({ src: url }),
				sdkSnippet: buildSdkEmbedSnippet({ src: url }),
				previewUrl: new URL(
					buildInternalPreviewPath({ projectId, sceneId }),
					origin
				).toString(),
				allowedDomains: parseAllowedDomainPatterns(project.allowedEmbedDomains)
			}
		} satisfies SceneEmbed,
		200,
		{ headers: { 'Cache-Control': 'no-store' } }
	)
}

// Gated anyway, so the route never tells a caller without a token anything.
export async function action({ request }: Route.ActionArgs) {
	await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['api-key:read']
	})
	return agentApiError(405, 'method_not_allowed', 'This route answers GET.', {
		headers: { Allow: 'GET' }
	})
}
