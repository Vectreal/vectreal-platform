/**
 * POST   /api/v1/scenes/:sceneId/publication  publishes the scene with the GLB
 *                                             sent as multipart `file`.
 * DELETE /api/v1/scenes/:sceneId/publication  takes it offline.
 *
 * Both need `scenes:publish` and an `Idempotency-Key`, and answer 200
 * `{ publication: { sceneId, status, publishedAt } }`.
 *
 * The GLB is what visitors load, stored as sent: the client compresses it
 * first, as the publisher's export does. It is written before the
 * transaction and taken back if the publish does not commit; the GLB a
 * publish replaces or an unpublish takes offline is collected only after the
 * commit.
 */

import { ApiResponse } from '@shared/utils'

import { UUID_REGEX } from '../../../constants/utility-constants'
import {
	agentApiError,
	agentBillingRefusal
} from '../../../lib/domain/agent/agent-api-response'
import { recordAgentAudit } from '../../../lib/domain/agent/agent-audit.server'
import { readAgentGlbUpload } from '../../../lib/domain/agent/agent-glb-upload.server'
import { withIdempotency } from '../../../lib/domain/agent/agent-idempotency.server'
import { AGENT_OPERATION_SCOPES } from '../../../lib/domain/agent/agent-operation-scopes'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { reclaimUploadBatch } from '../../../lib/domain/asset/asset-reclaim.server'
import {
	canPerformDashboardOperation,
	describeDashboardOperationDenial,
	type DashboardOperation
} from '../../../lib/domain/dashboard/dashboard-operations'
import { resolveSceneMembership } from '../../../lib/domain/dashboard/dashboard-permissions.server'
import {
	assertPublishLimits,
	requirePublishEntitlement
} from '../../../lib/domain/scene/server/scene-publish.operations.server'
import { sceneSettingsService } from '../../../lib/domain/scene/server/scene-settings-service.server'
import { storePublishedGlb } from '../../../lib/domain/scene/server/scene-upload.operations.server'

import type { Route } from './+types/scenes.$sceneId.publication'
import type { AgentActor } from '../../../lib/domain/agent/agent-actor.server'
import type { ScenePublication } from '@vctrl/sdk'

// Reading a publication is not served yet. Gated anyway, so the route never
// tells a caller without a token anything.
export async function loader({ request }: Route.LoaderArgs) {
	await authorizeAgentRequest(request, { scope: 'projects:read' })
	return methodNotAllowed()
}

export async function action({ request, params }: Route.ActionArgs) {
	const operation: DashboardOperation | null =
		request.method === 'POST'
			? 'scene:publish'
			: request.method === 'DELETE'
				? 'scene:unpublish'
				: null
	if (!operation) return methodNotAllowed()

	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES[operation]
	})
	const scene = await resolveScene(params.sceneId, actor, operation)

	return operation === 'scene:publish'
		? publish(request, actor, scene)
		: unpublish(request, actor, scene)
}

type ResolvedScene = { sceneId: string; projectId: string }

/**
 * The scene, or a 404 that does not say whether it exists: a malformed id,
 * one the user cannot see and one outside the grant's organization all answer
 * alike, so ids cannot be probed.
 */
async function resolveScene(
	sceneId: string | undefined,
	actor: AgentActor,
	operation: DashboardOperation
): Promise<ResolvedScene> {
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
	if (!canPerformDashboardOperation(operation, membership)) {
		throw agentApiError(
			403,
			'insufficient_role',
			describeDashboardOperationDenial(operation, membership.role)
		)
	}
	return { sceneId, projectId: membership.projectId }
}

async function publish(
	request: Request,
	actor: AgentActor,
	{ sceneId, projectId }: ResolvedScene
): Promise<Response> {
	const { glb, fileSha256 } = await readAgentGlbUpload(request)
	// Set only by a run that committed, never by a replay.
	let replacedAssetId: string | null = null

	const response = await withIdempotency(
		{ grantId: actor.grantId, request, payload: { sceneId, fileSha256 } },
		{
			// Before anything is uploaded, so a plan that cannot publish stores
			// nothing. Storage cannot join the transaction, so the GLB goes next,
			// as one batch named by this attempt's claim.
			prepare: async ({ claimId }) => {
				try {
					const { effectivePlan } = await requirePublishEntitlement(
						actor.organizationId
					)
					const { assetId } = await storePublishedGlb({
						sceneId,
						userId: actor.userId,
						projectId,
						bytes: glb,
						requestId: claimId
					})
					return { assetId, effectivePlan }
				} catch (error) {
					const refusal = agentBillingRefusal(error, request)
					if (!refusal) throw error
					return refusal
				}
			},
			run: async (tx, { assetId, effectivePlan }) => {
				try {
					await assertPublishLimits(tx, {
						sceneId,
						projectId,
						organizationId: actor.organizationId,
						effectivePlan,
						publishedAssetId: assetId
					})
				} catch (error) {
					const refusal = agentBillingRefusal(error, request)
					if (!refusal) throw error
					return refusal
				}

				const { record, previousAssetId } =
					await sceneSettingsService.publishSceneWithin(tx, {
						sceneId,
						projectId,
						userId: actor.userId,
						publishedAssetId: assetId
					})
				await recordAgentAudit(tx, actor, 'scene:publish', sceneId)
				replacedAssetId = previousAssetId

				return publicationResponse({
					sceneId,
					status: 'published',
					publishedAt: record.publishedAt.toISOString()
				})
			},
			undo: async ({ claimId }) => {
				await reclaimUploadBatch({ requestId: claimId, projectId })
			}
		}
	)

	await collectAfterCommit(response, replacedAssetId)
	return response
}

async function unpublish(
	request: Request,
	actor: AgentActor,
	{ sceneId }: ResolvedScene
): Promise<Response> {
	let revokedAssetId: string | null = null

	const response = await withIdempotency(
		{ grantId: actor.grantId, request, payload: { sceneId } },
		async (tx) => {
			revokedAssetId = await sceneSettingsService.revokeScenePublicationWithin(
				tx,
				sceneId
			)
			await recordAgentAudit(tx, actor, 'scene:unpublish', sceneId)
			// A scene that was never published ends where this one does.
			return publicationResponse({
				sceneId,
				status: 'draft',
				publishedAt: null
			})
		}
	)

	await collectAfterCommit(response, revokedAssetId)
	return response
}

/**
 * Deletes the GLB a committed change unlinked, if nothing else references it.
 * After the commit, so a rollback never leaves a publication pointing at a
 * deleted file; and never for a replay, whose change committed long ago.
 */
async function collectAfterCommit(
	response: Response,
	unlinkedAssetId: string | null
): Promise<void> {
	if (!response.ok || !unlinkedAssetId) return
	await sceneSettingsService.collectUnreferencedAssets([unlinkedAssetId])
}

function publicationResponse(
	publication: ScenePublication['publication']
): Response {
	return ApiResponse.success({ publication } satisfies ScenePublication, 200, {
		headers: { 'Cache-Control': 'no-store' }
	})
}

function methodNotAllowed(): Response {
	return agentApiError(
		405,
		'method_not_allowed',
		'This route answers POST and DELETE.',
		{ headers: { Allow: 'POST, DELETE' } }
	)
}
