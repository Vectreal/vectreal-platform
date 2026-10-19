/**
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

import { createHash } from 'node:crypto'

import { ApiResponse } from '@shared/utils'
import { createSceneInputSchema } from '@vctrl/sdk'

import {
	MAX_STORED_FILE_BYTES,
	UUID_REGEX
} from '../../../constants/utility-constants'
import { withSceneSettingsDefaults } from '../../../constants/viewer-defaults'
import {
	agentApiError,
	agentBillingRefusal
} from '../../../lib/domain/agent/agent-api-response'
import { recordAgentAudit } from '../../../lib/domain/agent/agent-audit.server'
import { withIdempotency } from '../../../lib/domain/agent/agent-idempotency.server'
import { AGENT_OPERATION_SCOPES } from '../../../lib/domain/agent/agent-operation-scopes'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { reclaimUploadBatch } from '../../../lib/domain/asset/asset-reclaim.server'
import { uploadSceneAssets } from '../../../lib/domain/asset/asset-storage.server'
import {
	canPerformDashboardOperation,
	describeDashboardOperationDenial
} from '../../../lib/domain/dashboard/dashboard-operations'
import { resolveProjectMembership } from '../../../lib/domain/dashboard/dashboard-permissions.server'
import {
	GlbFormatError,
	SPLIT_BIN_FILE_NAME,
	SPLIT_GLTF_FILE_NAME,
	splitGlb
} from '../../../lib/domain/scene/glb-container'
import { sceneSettingsService } from '../../../lib/domain/scene/server/scene-settings-service.server'
import { prepareSceneUpload } from '../../../lib/domain/scene/server/scene-upload.operations.server'

import type { Route } from './+types/projects.$projectId.scenes'
import type { CreatedScene } from '@vctrl/sdk'

// The multipart envelope around the file is small; this only stops a body far
// past the cap from being read into memory before it is refused.
const MAX_BODY_BYTES = MAX_STORED_FILE_BYTES + 1024 * 1024

// Listing scenes is not served yet. Gated anyway, so the route never tells a
// caller without a token anything.
export async function loader({ request }: Route.LoaderArgs) {
	await authorizeAgentRequest(request, { scope: 'projects:read' })
	return methodNotAllowed()
}

export async function action({ request, params }: Route.ActionArgs) {
	if (request.method !== 'POST') return methodNotAllowed()

	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['scene:create']
	})

	// A project outside the grant's organization answers like one that does
	// not exist, so ids cannot be probed.
	// A malformed id would fail the uuid cast as a 500; it names no project.
	const { projectId } = params
	const membership =
		projectId &&
		UUID_REGEX.test(projectId) &&
		(await resolveProjectMembership(projectId, actor.userId))
	if (!membership || membership.organizationId !== actor.organizationId) {
		throw agentApiError(404, 'not_found', 'No such project.')
	}
	if (!canPerformDashboardOperation('scene:create', membership)) {
		throw agentApiError(
			403,
			'insufficient_role',
			describeDashboardOperationDenial('scene:create', membership.role)
		)
	}

	const { name, glb } = await readSceneUpload(request)
	const gltf = splitGlbOrRefuse(glb)

	return withIdempotency(
		{
			grantId: actor.grantId,
			request,
			payload: {
				projectId,
				name,
				fileSha256: createHash('sha256').update(glb).digest('hex')
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

async function readSceneUpload(
	request: Request
): Promise<{ name: string; glb: Uint8Array }> {
	const declaredLength = Number(request.headers.get('Content-Length'))
	if (declaredLength > MAX_BODY_BYTES) throw tooLarge()

	const form = await readLimitedFormData(request).catch((error: unknown) => {
		if (error instanceof BodyTooLarge) throw tooLarge()
		return null
	})
	const file = form?.get('file')
	const input = createSceneInputSchema.safeParse({ name: form?.get('name') })
	if (!(file instanceof File) || !input.success) {
		throw agentApiError(
			400,
			'invalid_request',
			'Send multipart/form-data with `file`, one GLB, and `name`, 1 to 100 characters.',
			input.success ? {} : { extra: { issues: input.error.issues } }
		)
	}
	if (file.size > MAX_STORED_FILE_BYTES) throw tooLarge()

	return {
		name: input.data.name,
		glb: new Uint8Array(await file.arrayBuffer())
	}
}

class BodyTooLarge extends Error {}

/**
 * The multipart body, read with a byte cap. `Content-Length` is optional (a
 * chunked upload has none), so the cap is counted on the stream itself rather
 * than trusted from the header.
 */
async function readLimitedFormData(request: Request): Promise<FormData> {
	if (!request.body) throw new TypeError('The request has no body.')
	let received = 0
	const limited = request.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				received += chunk.byteLength
				if (received > MAX_BODY_BYTES) controller.error(new BodyTooLarge())
				else controller.enqueue(chunk)
			}
		})
	)
	return new Response(limited, {
		headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' }
	}).formData()
}

function splitGlbOrRefuse(glb: Uint8Array) {
	try {
		return splitGlb(glb)
	} catch (error) {
		if (!(error instanceof GlbFormatError)) throw error
		throw agentApiError(400, 'invalid_request', error.message)
	}
}

function tooLarge(): Response {
	return agentApiError(
		413,
		'invalid_request',
		`The GLB is over the ${MAX_STORED_FILE_BYTES / 1024 / 1024} MB a scene file can take. Compress it first, for example with Draco and KTX2.`
	)
}

function methodNotAllowed(): Response {
	return agentApiError(405, 'method_not_allowed', 'This route answers POST.', {
		headers: { Allow: 'POST' }
	})
}
