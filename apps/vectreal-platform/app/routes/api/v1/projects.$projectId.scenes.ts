/**
 * GET  /api/v1/projects/:projectId/scenes  the project's scenes, the most
 *                                          recently edited first. Needs
 *                                          `projects:read`; answers
 *                                          `{ scenes: [{ id, name, status, updatedAt }] }`.
 * POST /api/v1/projects/:projectId/scenes  creates a scene from one GLB.
 *                                          Multipart: `file`, the GLB, and
 *                                          `name`. Needs `projects:write` and
 *                                          an `Idempotency-Key`; answers 201
 *                                          `{ scene: { id, projectId, name } }`.
 *
 * The GLB is stored as the scene's glTF JSON and binary buffer, split without
 * decoding (`splitGlb`), which is a layout the publisher and the viewer
 * already read. Its files are written before the transaction and taken back if
 * it does not commit.
 */

import { ApiResponse } from '@shared/utils'
import { createSceneInputSchema } from '@vctrl/sdk'

import { withSceneSettingsDefaults } from '../../../constants/viewer-defaults'
import {
	agentApiError,
	agentBillingRefusal
} from '../../../lib/domain/agent/agent-api-response'
import { recordAgentAudit } from '../../../lib/domain/agent/agent-audit.server'
import { readAgentGlbUpload } from '../../../lib/domain/agent/agent-glb-upload.server'
import { withIdempotency } from '../../../lib/domain/agent/agent-idempotency.server'
import { AGENT_OPERATION_SCOPES } from '../../../lib/domain/agent/agent-operation-scopes'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { resolveAgentProject } from '../../../lib/domain/agent/agent-resource.server'
import { reclaimUploadBatch } from '../../../lib/domain/asset/asset-reclaim.server'
import { uploadSceneAssets } from '../../../lib/domain/asset/asset-storage.server'
import {
	SPLIT_BIN_FILE_NAME,
	SPLIT_GLTF_FILE_NAME
} from '../../../lib/domain/scene/glb-container'
import { getProjectsScenes } from '../../../lib/domain/scene/server/scene-folder-repository.server'
import { sceneSettingsService } from '../../../lib/domain/scene/server/scene-settings-service.server'
import { prepareSceneUpload } from '../../../lib/domain/scene/server/scene-upload.operations.server'

import type { Route } from './+types/projects.$projectId.scenes'
import type { CreatedScene, SceneList } from '@vctrl/sdk'

export async function loader({ request, params }: Route.LoaderArgs) {
	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['project:read']
	})
	const { projectId } = await resolveAgentProject(
		params.projectId,
		actor,
		'project:read'
	)

	const scenes = (await getProjectsScenes([projectId], actor.userId)).get(
		projectId
	)
	return ApiResponse.success(
		{
			scenes: (scenes ?? []).map((scene) => ({
				id: scene.id,
				name: scene.name,
				status: scene.status,
				updatedAt: scene.updatedAt.toISOString()
			}))
		} satisfies SceneList,
		200,
		{ headers: { 'Cache-Control': 'no-store' } }
	)
}

export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed()

	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['scene:create']
	})

	const { projectId } = await resolveAgentProject(
		params.projectId,
		actor,
		'scene:create'
	)

	const { form, split: gltf, fileSha256 } = await readAgentGlbUpload(request)
	const input = createSceneInputSchema.safeParse({ name: form.get('name') })
	if (!input.success) {
		throw agentApiError(
			400,
			'invalid_request',
			'Send `name` beside the file, 1 to 100 characters.',
			{ extra: { issues: input.error.issues } }
		)
	}
	const { name } = input.data

	return withIdempotency(
		{
			grantId: actor.grantId,
			request,
			payload: {
				projectId,
				name,
				fileSha256
			}
		},
		{
			// Storage cannot join the transaction, so the files go first, as
			// one batch named by this attempt's claim.
			prepare: async ({ claimId }) => {
				try {
					const { sceneId } = await prepareSceneUpload(
						{ action: 'create-scene', targetProjectId: projectId },
						actor.userId
					)
					const uploads = await uploadSceneAssets(
						sceneId,
						actor.userId,
						projectId,
						[
							{
								fileName: SPLIT_GLTF_FILE_NAME,
								data: gltf.gltfJson,
								mimeType: 'model/gltf+json',
								type: 'buffer'
							},
							...(gltf.bin
								? [
										{
											fileName: SPLIT_BIN_FILE_NAME,
											data: gltf.bin,
											mimeType: 'application/octet-stream',
											type: 'buffer' as const
										}
									]
								: [])
						],
						claimId
					)
					return { sceneId, assetIds: uploads.map((upload) => upload.assetId) }
				} catch (error) {
					const refusal = agentBillingRefusal(error, request)
					if (!refusal) throw error
					return refusal
				}
			},
			run: async (tx, { sceneId, assetIds }) => {
				// A new scene unlinks nothing, so there is nothing to collect.
				await sceneSettingsService.saveSceneSettingsWithin(tx, {
					sceneId,
					projectId,
					userId: actor.userId,
					meta: { name, description: '', thumbnailUrl: '' },
					settings: withSceneSettingsDefaults({}),
					sceneAssetIds: assetIds
				})
				await recordAgentAudit(tx, actor, 'scene:create', sceneId)

				return ApiResponse.success(
					{ scene: { id: sceneId, projectId, name } } satisfies CreatedScene,
					201,
					{ headers: { 'Cache-Control': 'no-store' } }
				)
			},
			undo: async ({ claimId }) => {
				await reclaimUploadBatch({ requestId: claimId, projectId })
			}
		}
	)
}

function methodNotAllowed(): Response {
	return agentApiError(
		405,
		'method_not_allowed',
		'This route answers GET and POST.',
		{ headers: { Allow: 'GET, POST' } }
	)
}
