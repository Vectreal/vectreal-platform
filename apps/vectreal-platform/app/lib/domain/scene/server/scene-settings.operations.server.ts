import { randomUUID } from 'crypto'

import { ApiResponse } from '@shared/utils'
import { SerializedSceneAssetDataMap, SceneSettings } from '@vctrl/core'
import { count, eq } from 'drizzle-orm'

import { getScene, getSceneFolder } from './scene-folder-repository.server'
import { sceneSettingsService } from './scene-settings-service.server'
import { isBillingStateReadOnly } from '../../../../constants/plan-config'
import { getDbClient } from '../../../../db/client'
import { projects } from '../../../../db/schema/project/projects'
import { scenePublished } from '../../../../db/schema/project/scene-published'
import { scenes } from '../../../../db/schema/project/scenes'
import { reportServerError } from '../../../observability/report-server-error.server'
import {
	reclaimStaleProjectAssets,
	reclaimUploadBatch
} from '../../asset/asset-reclaim.server'
import { uploadSceneAssets } from '../../asset/asset-storage.server'
import {
	EntitlementRequiredError,
	isRoutableDomainError
} from '../../billing/entitlement-required-error'
import {
	hasEntitlement,
	getRecommendedUpgrade,
	getOrgSubscription,
	getQuotaLimit
} from '../../billing/entitlement-service.server'
import { assertWithinQuota } from '../../billing/quota-enforcement.server'
import { QuotaExceededError } from '../../billing/quota-exceeded-error'
import { getProject } from '../../project/project-repository.server'
import {
	getOrCreateDefaultOrganization,
	getOrCreateDefaultProject,
	userExists
} from '../../user/user-repository.server'
import { isSceneOverSizeLimit } from '../scene-size-limit'

import type { EntitlementKey } from '../../../../constants/plan-config'
import type { SceneSettingsRequest } from '../../../../types/api'
import type { SceneMetaState } from '../../../../types/publisher-config'

type SaveSceneSettingsRequest = SceneSettingsRequest & {
	meta: SceneMetaState
	settings: SceneSettings
	sceneAssetIds: string[]
}

type GetSceneSettingsRequest = SceneSettingsRequest & {
	sceneId: string
}

type PublishSceneRequest = SceneSettingsRequest & {
	sceneId: string
	publishedAssetId: string
	currentSceneBytes?: number
}

type UploadPreparedScene = {
	sceneId: string
	projectId: string
	existingAssets: Record<string, { assetId: string; contentHash: string }>
}

function assertParsed<T>(value: T, message: string): asserts value is T {
	if (!value) {
		throw new Error(message)
	}
}

/**
 * Gets the project ID for an existing scene
 */
async function getSceneProjectId(sceneId: string): Promise<string> {
	const projectId = await sceneSettingsService.getProjectIdFromScene(sceneId)
	if (!projectId) {
		throw new Error(`Scene not found with ID: ${sceneId}`)
	}
	return projectId
}

/**
 * Creates a new scene in the user's default project
 */
async function createNewScene(
	userId: string
): Promise<{ sceneId: string; projectId: string }> {
	const newSceneId = randomUUID()
	const project = await getOrCreateDefaultProject(userId)
	return { sceneId: newSceneId, projectId: project.id }
}

/**
 * Resolves scene and project IDs, creating a new scene if needed
 */
async function resolveSceneAndProject(
	sceneId: string | undefined,
	userId: string,
	targetProjectId?: string,
	projectId?: string
): Promise<{
	sceneId: string
	projectId: string
	existingProjectId: string | null
}> {
	if (sceneId?.trim()) {
		const existingProjectId =
			await sceneSettingsService.getProjectIdFromScene(sceneId)

		if (existingProjectId) {
			const resolvedProjectId = targetProjectId ?? existingProjectId
			return { sceneId, projectId: resolvedProjectId, existingProjectId }
		}

		const fallbackProjectId = targetProjectId ?? projectId
		if (fallbackProjectId) {
			const project = await getProject(fallbackProjectId, userId)
			if (!project) {
				throw new Error('Target project not found or access denied')
			}

			return { sceneId, projectId: fallbackProjectId, existingProjectId: null }
		}

		throw new Error(`Scene not found with ID: ${sceneId}`)
	}

	// Create new scene if no ID provided
	if (targetProjectId) {
		const project = await getProject(targetProjectId, userId)
		if (!project) {
			throw new Error('Target project not found or access denied')
		}

		return {
			sceneId: randomUUID(),
			projectId: targetProjectId,
			existingProjectId: null
		}
	}

	const created = await createNewScene(userId)
	return { ...created, existingProjectId: null }
}

async function validateSaveLocationTarget(
	request: SceneSettingsRequest,
	userId: string,
	resolvedProjectId: string
): Promise<void> {
	if (request.targetProjectId) {
		const project = await getProject(request.targetProjectId, userId)
		if (!project) {
			throw new Error('Target project not found or access denied')
		}
	}

	if (typeof request.targetFolderId === 'undefined') {
		return
	}

	if (request.targetFolderId === null) {
		return
	}

	const folder = await getSceneFolder(request.targetFolderId, userId)
	if (!folder) {
		throw new Error('Target folder not found or access denied')
	}

	if (folder.projectId !== resolvedProjectId) {
		throw new Error('Target folder must belong to the selected project')
	}

	/*
	  Nested folders used to be rejected here with "Only root-level folders are
	  allowed", while the publisher's location picker rendered the whole tree
	  with depth indentation - so picking a subfolder produced a 500. Folders are
	  hierarchical by design, `getSceneFolderTree` reports depth, and the
	  dashboard now moves scenes into subfolders freely, so the restriction was
	  the odd one out rather than the rule.
	*/
}

/**
 * The organization whose plan governs a scene save.
 *
 * Resolves the same destination `resolveSceneAndProject` will, in the same
 * order, because a guard that grades a different organization from the one that
 * ends up holding the row is worse than no guard: it lets a lapsed organization
 * through whenever the caller has a healthy one, and refuses paid work whenever
 * they do not.
 *
 * `targetProjectId` first, then the scene's own project, then `projectId` for a
 * scene whose row does not exist yet. A scene id that resolves to none of those
 * is rejected here exactly as the resolver rejects it.
 *
 * The caller's default organization is reached only by a save that names no
 * scene and no project, which is the one shape that legitimately creates one.
 */
async function resolveOwningOrganizationId(
	request: SceneSettingsRequest,
	userId: string
): Promise<string> {
	if (request.targetProjectId) {
		const project = await getProject(request.targetProjectId, userId)
		if (!project) {
			throw new Error('Target project not found or access denied')
		}
		return project.organizationId
	}

	/*
	  An existing scene already has a home, and it may be in an organization the
	  caller was invited to rather than their own. Falling straight through to
	  the caller's default organization graded the wrong tenant in both
	  directions: a read-only invited organization kept uploading, and legitimate
	  work in a paid one was refused because the caller's personal organization
	  had lapsed. `upload-published-glb` never sends `targetProjectId`, so that
	  was the ordinary path rather than a corner of it.
	*/
	const sceneId = request.sceneId?.trim()
	if (sceneId) {
		const scenesProjectId =
			await sceneSettingsService.getProjectIdFromScene(sceneId)
		if (scenesProjectId) {
			const project = await getProject(scenesProjectId, userId)
			if (!project) {
				throw new Error('Scene project not found or access denied')
			}
			return project.organizationId
		}

		/*
		  A scene id with no row yet, which is not a rare shape: `prepareSceneUpload`
		  mints the id for a new scene and nothing writes the row until
		  `commit-scene-save`, so every upload of a first save carries one. This
		  mirrors `resolveSceneAndProject`, which falls back to `projectId` in
		  exactly this arm - and only in this arm. With no scene id at all it
		  ignores `projectId` entirely and creates the scene in the caller's own
		  default project, so reading the field out here would grade an
		  organization the scene never reaches, in both directions.
		*/
		if (request.projectId) {
			const project = await getProject(request.projectId, userId)
			if (!project) {
				throw new Error('Project not found or access denied')
			}
			return project.organizationId
		}

		/*
		  A scene id with no row and no project named anywhere. This is the shape
		  `resolveSceneAndProject` rejects, so reject it identically rather than
		  falling through: the fallback below would resolve the caller's default
		  organization - creating one, for anyone who renamed theirs - on the way
		  to a request that cannot succeed.
		*/
		throw new Error(`Scene not found with ID: ${sceneId}`)
	}

	/*
	  Only a save naming neither a scene nor a project reaches here, which is the
	  one case where creating the caller's default organization is the right
	  answer rather than a side effect. Keeping the upload actions out of it
	  matters:
	  `getOrCreateDefaultOrganization` matches on the literal name
	  'My Organization', so for anyone who renamed theirs it inserts a fresh one -
	  and the guard then grades an organization that is empty and always grants.
	*/
	return (await getOrCreateDefaultOrganization(userId)).id
}

export async function prepareSceneUpload(
	request: SceneSettingsRequest,
	userId: string
): Promise<UploadPreparedScene> {
	const hasUser = await userExists(userId)
	if (!hasUser) {
		throw new Error(
			'User not found in local database. Please sign out and sign back in.'
		)
	}

	const isNewScene = !request.sceneId?.trim()

	/*
	  `scene_upload` has sat in `READ_ONLY_BLOCKED_ENTITLEMENTS` since that set
	  was written, and this file's header describes it as blocking uploads, but
	  no call site ever passed it - so an organization whose billing went
	  `unpaid` or `paused` kept uploading freely while its sibling
	  `scene_publish` correctly refused. It is `true` on every plan, so this can
	  only ever deny on billing state; there is no upgrade that grants it.

	  Every upload action reaches this function, which is why the check is here
	  rather than at each of the three.
	*/
	// Named once. Written twice, the key consulted and the key reported could
	// disagree, and the error would name an entitlement nothing checked.
	const uploadEntitlementKey: EntitlementKey = 'scene_upload'
	const uploadEntitlement = await hasEntitlement(
		await resolveOwningOrganizationId(request, userId),
		uploadEntitlementKey
	)
	if (!uploadEntitlement.granted) {
		throw new EntitlementRequiredError({
			entitlementKey: uploadEntitlementKey,
			plan: uploadEntitlement.effectivePlan,
			billingState: uploadEntitlement.billingState,
			upgradeTo: getRecommendedUpgrade(uploadEntitlement.effectivePlan),
			message: isBillingStateReadOnly(uploadEntitlement.billingState)
				? 'Uploads are unavailable: payment required to restore access.'
				: 'Uploads are not available on your current plan.'
		})
	}

	/*
	  The organization whose limits apply is the one that will own the scene, not
	  necessarily the caller's own: `targetProjectId` can name a project in an org
	  they were invited into. Counting their personal org would enforce the wrong
	  tenant in both directions - theirs refusing a scene it will never hold, the
	  target's never enforced at all.

	  Resolved only when a guard below actually needs it. It was briefly hoisted,
	  which put `getOrCreateDefaultOrganization` - a transaction that *creates* an
	  organization when its name lookup misses - on the per-asset upload calls,
	  which need no guard at all.
	*/
	if (isNewScene) {
		const organizationId = await resolveOwningOrganizationId(request, userId)
		await assertWithinQuota({
			organizationId,
			limitKey: 'scenes_total',
			measure: async () => {
				const [row] = await getDbClient()
					.select({ total: count() })
					.from(scenes)
					.innerJoin(projects, eq(projects.id, scenes.projectId))
					.where(eq(projects.organizationId, organizationId))
				return row?.total ?? 0
			},
			message: ({ limit }) =>
				`Scene limit reached for your plan (${limit}). Delete a scene or upgrade to create more.`
		})
	}

	/*
	  Enforced against the reported final (post-optimization) scene size.
	  `currentSceneBytes` is client-reported - the same value that feeds scene
	  stats - so this is a plan gate, not a security boundary. The storage
	  bucket's own per-file limit is the boundary.

	  This comment used to name `storage_bytes_total` as a second hard backstop.
	  It was not one, and it still is not: nothing enforces it. Enforcing it here
	  was tried and reverted, because the figure arrives from the same client
	  value and is absent from every path that actually writes bytes.
	*/
	if (typeof request.currentSceneBytes === 'number') {
		const organizationId = await resolveOwningOrganizationId(request, userId)
		const { limit } = await getQuotaLimit(
			organizationId,
			'storage_bytes_per_scene'
		)
		if (isSceneOverSizeLimit(request.currentSceneBytes, limit)) {
			const { plan } = await getOrgSubscription(organizationId)
			throw new QuotaExceededError({
				limitKey: 'storage_bytes_per_scene',
				currentValue: request.currentSceneBytes,
				limit,
				plan,
				upgradeTo: getRecommendedUpgrade(plan),
				message:
					'Scene exceeds the maximum size for your plan. Optimize further or upgrade.'
			})
		}
	}

	const resolved = await resolveSceneAndProject(
		request.sceneId,
		userId,
		request.targetProjectId,
		request.projectId
	)

	// Reuse already-stored assets for same-project saves (the common case), so the
	// client can content-hash dedupe and skip re-uploading unchanged model assets.
	// Only a genuine move to a DIFFERENT project must re-upload assets fresh into
	// that project's storage. Previously ANY targetProjectId disabled dedup — and
	// the post-save location sync sets targetProjectId on every save after the
	// first, so identical assets were re-uploaded on every subsequent save.
	// A targeted save is treated as a cross-project move (no asset reuse) when the
	// target differs from the scene's established project, OR when the scene has no
	// established project to compare against. Same-project saves reuse assets.
	const isCrossProjectMove =
		!!request.targetProjectId &&
		(resolved.existingProjectId === null ||
			request.targetProjectId !== resolved.existingProjectId)

	const existingAssets =
		request.sceneId?.trim() && !isCrossProjectMove
			? await sceneSettingsService.getExistingAssetHashes(resolved.sceneId)
			: {}

	return {
		sceneId: resolved.sceneId,
		projectId: resolved.projectId,
		existingAssets
	}
}

export async function uploadSceneAsset(
	request: SceneSettingsRequest,
	userId: string,
	file: File,
	kind: 'buffer' | 'image'
): Promise<Response> {
	try {
		const { sceneId, projectId } = await prepareSceneUpload(request, userId)
		const bytes = new Uint8Array(await file.arrayBuffer())

		const [uploadResult] = await uploadSceneAssets(
			sceneId,
			userId,
			projectId,
			[
				{
					fileName: file.name,
					data: bytes,
					mimeType: file.type || 'application/octet-stream',
					type: kind
				}
			],
			request.requestId
		)

		return ApiResponse.success({
			sceneId,
			projectId,
			assetId: uploadResult.assetId,
			fileName: uploadResult.fileName,
			mimeType: uploadResult.mimeType
		})
	} catch (error) {
		/*
		  A quota or entitlement refusal is not a server error. Flattening one
		  here reaches the client as a 500 carrying its message and none of its
		  meaning - no limit, no plan, no upgrade prompt, no payment prompt. The
		  route's own handler maps both.
		*/
		if (isRoutableDomainError(error)) {
			throw error
		}
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to upload scene asset'
		)
	}
}

export async function uploadSceneGltf(
	request: SceneSettingsRequest,
	userId: string,
	file: File
): Promise<Response> {
	try {
		const { sceneId, projectId } = await prepareSceneUpload(request, userId)
		const bytes = new Uint8Array(await file.arrayBuffer())

		const [uploadResult] = await uploadSceneAssets(
			sceneId,
			userId,
			projectId,
			[
				{
					fileName: file.name || 'scene.gltf',
					data: bytes,
					mimeType: file.type || 'model/gltf+json',
					type: 'buffer'
				}
			],
			request.requestId
		)

		return ApiResponse.success({
			sceneId,
			projectId,
			assetId: uploadResult.assetId,
			fileName: uploadResult.fileName,
			mimeType: uploadResult.mimeType
		})
	} catch (error) {
		/*
		  A quota or entitlement refusal is not a server error. Flattening one
		  here reaches the client as a 500 carrying its message and none of its
		  meaning - no limit, no plan, no upgrade prompt, no payment prompt. The
		  route's own handler maps both.
		*/
		if (isRoutableDomainError(error)) {
			throw error
		}
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to upload scene glTF'
		)
	}
}

export async function uploadPublishedGlb(
	request: SceneSettingsRequest,
	userId: string,
	file: File
): Promise<Response> {
	try {
		const { sceneId, projectId } = await prepareSceneUpload(request, userId)
		const bytes = new Uint8Array(await file.arrayBuffer())

		const [uploadResult] = await uploadSceneAssets(
			sceneId,
			userId,
			projectId,
			[
				{
					fileName: file.name || 'scene.glb',
					data: bytes,
					mimeType: file.type || 'model/gltf-binary',
					type: 'buffer'
				}
			],
			request.requestId
		)

		return ApiResponse.success({
			sceneId,
			projectId,
			assetId: uploadResult.assetId,
			fileName: uploadResult.fileName,
			mimeType: uploadResult.mimeType
		})
	} catch (error) {
		/*
		  A quota or entitlement refusal is not a server error. Flattening one
		  here reaches the client as a 500 carrying its message and none of its
		  meaning - no limit, no plan, no upgrade prompt, no payment prompt. The
		  route's own handler maps both.
		*/
		if (isRoutableDomainError(error)) {
			throw error
		}
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to upload published GLB'
		)
	}
}

export async function saveSceneSettings(
	request: SceneSettingsRequest,
	userId: string
): Promise<Response> {
	let reclaimProjectId: string | null = null

	try {
		console.info('[scene-settings] save operation started', {
			requestId: request.requestId,
			userId,
			sceneId: request.sceneId || null
		})

		const validationResult = request as SaveSceneSettingsRequest
		assertParsed(
			validationResult.settings,
			'Scene settings request must be validated before calling operations'
		)
		assertParsed(
			validationResult.sceneAssetIds,
			'commit-scene-save requires sceneAssetIds'
		)

		const hasUser = await userExists(userId)
		if (!hasUser) {
			throw new Error(
				'User not found in local database. Please sign out and sign back in.'
			)
		}

		const { sceneId: finalSceneId, projectId } = await resolveSceneAndProject(
			request.sceneId,
			userId,
			request.targetProjectId,
			request.projectId
		)
		// Held outside the try so a rejected save can still reclaim what its
		// uploads already wrote.
		reclaimProjectId = projectId

		await validateSaveLocationTarget(request, userId, projectId)

		const saveResult = await sceneSettingsService.saveSceneSettingsFromAssetIds(
			{
				sceneId: finalSceneId,
				projectId,
				targetProjectId: request.targetProjectId,
				targetFolderId: request.targetFolderId,
				userId,
				meta: validationResult.meta,
				settings: validationResult.settings,
				sceneAssetIds: validationResult.sceneAssetIds,
				optimizationReport: request.optimizationReport,
				optimizationSettings: request.optimizationSettings,
				initialSceneBytes: request.initialSceneBytes,
				currentSceneBytes: request.currentSceneBytes
			}
		)

		console.info('[scene-settings] save operation completed', {
			requestId: request.requestId,
			userId,
			sceneId: finalSceneId,
			projectId,
			unchanged: Boolean((saveResult as { unchanged?: boolean }).unchanged)
		})

		// Anything this batch uploaded that the commit did not link is
		// unreachable from here on: it is in no link table, so no later save or
		// delete would ever list it as a candidate.
		await reclaimUploadBatch({
			requestId: request.requestId,
			projectId,
			keepAssetIds: validationResult.sceneAssetIds
		})
		// Backstop for batches that never reached any commit, so no request ever
		// carries their id. A successful save is the only in-band trigger there is.
		await reclaimStaleProjectAssets({ projectId })

		const [stats, savedScene] = await Promise.all([
			sceneSettingsService.getSceneStats(finalSceneId),
			getScene(finalSceneId, userId)
		])
		if (!savedScene) {
			throw new Error(`Scene not found with ID: ${finalSceneId}`)
		}

		const [project, folder] = await Promise.all([
			getProject(savedScene.projectId, userId),
			savedScene.folderId
				? getSceneFolder(savedScene.folderId, userId)
				: Promise.resolve(null)
		])

		const result = {
			...saveResult,
			sceneId: finalSceneId,
			stats,
			currentLocation: {
				projectId: savedScene.projectId,
				projectName: project?.name ?? null,
				folderId: savedScene.folderId,
				folderName: folder?.name ?? null
			}
		}
		return ApiResponse.success(result)
	} catch (error) {
		reportServerError(error, {
			properties: {
				requestId: request.requestId,
				userId,
				sceneId: request.sceneId || null
			}
		})
		// The uploads are already committed to storage by the time the save is
		// rejected. Nothing linked them, so this is the last chance to find them.
		if (reclaimProjectId) {
			await reclaimUploadBatch({
				requestId: request.requestId,
				projectId: reclaimProjectId
			})
		}
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to save scene settings'
		)
	}
}

export async function getSceneSettings(
	request: SceneSettingsRequest,
	options?: { forPublicView?: boolean }
): Promise<Response> {
	try {
		const { sceneId } = request as GetSceneSettingsRequest
		assertParsed(
			sceneId,
			'Scene settings request must be validated before calling operations'
		)

		const projectId = await sceneSettingsService.getProjectIdFromScene(sceneId)
		if (!projectId) {
			return ApiResponse.notFound(`Scene not found with ID: ${sceneId}`)
		}

		const [result, meta] = await Promise.all([
			sceneSettingsService.getSceneSettingsWithAssets(sceneId),
			sceneSettingsService.getSceneMetadata(sceneId)
		])
		const serialized: SerializedSceneAssetDataMap = {}
		result?.assetDataMap?.forEach((value, key) => {
			serialized[key] = {
				data: Buffer.from(value.data).toString('base64'),
				mimeType: value.mimeType,
				fileName: value.fileName,
				encoding: 'base64'
			}
		})

		if (!result) {
			return ApiResponse.success({
				meta,
				settings: null,
				assets: null,
				assetData: serialized,
				gltfJson: null
			})
		}

		const finalResult =
			options?.forPublicView && result.settings?.hotspots
				? {
						...result,
						settings: {
							...result.settings,
							hotspots: result.settings.hotspots.filter((h) => !h.internalOnly)
						}
					}
				: result

		return ApiResponse.success({ ...finalResult, meta, assetData: serialized })
	} catch (error) {
		reportServerError(error, {
			properties: { sceneId: request.sceneId || null }
		})
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to get scene settings'
		)
	}
}

export async function publishScene(
	request: SceneSettingsRequest,
	userId: string
): Promise<Response> {
	// The GLB is uploaded in its own request, before any of the checks below run,
	// so an entitlement refusal, a quota refusal or a thrown error all leave it
	// in storage linked to nothing. Reclaiming in `finally` covers every exit
	// from this function with one call site rather than four.
	let reclaimProjectId: string | null = null
	let keepAssetIds: string[] = []

	try {
		const { sceneId, publishedAssetId, currentSceneBytes } =
			request as PublishSceneRequest
		assertParsed(
			sceneId,
			'Scene settings request must be validated before calling operations'
		)
		assertParsed(
			publishedAssetId,
			'commit-scene-publish requires publishedAssetId'
		)

		// Ensure user exists in local database
		const hasUser = await userExists(userId)
		if (!hasUser) {
			throw new Error(
				'User not found in local database. Please sign out and sign back in.'
			)
		}

		const projectId = await getSceneProjectId(sceneId)
		reclaimProjectId = projectId
		const project = await getProject(projectId, userId)
		if (!project) {
			throw new Error('Project not found or access denied')
		}

		const publishEntitlement = await hasEntitlement(
			project.organizationId,
			'scene_publish'
		)

		if (!publishEntitlement.granted) {
			if (isBillingStateReadOnly(publishEntitlement.billingState)) {
				return ApiResponse.paymentRequired(
					'Publishing is unavailable: payment required to restore access.'
				)
			}
			return ApiResponse.forbidden(
				'Publishing is not available on your current plan.'
			)
		}

		const db = getDbClient()
		const [existingPublish] = await db
			.select({ sceneId: scenePublished.sceneId })
			.from(scenePublished)
			.where(eq(scenePublished.sceneId, sceneId))
			.limit(1)

		// Enforce concurrent publish quota only when this scene is not already published.
		if (!existingPublish) {
			const effectivePlan = publishEntitlement.effectivePlan
			const useProjectScopedLimit = effectivePlan === 'free'
			const [{ totalPublished }] = useProjectScopedLimit
				? await db
						.select({ totalPublished: count(scenePublished.sceneId) })
						.from(scenePublished)
						.innerJoin(scenes, eq(scenes.id, scenePublished.sceneId))
						.where(eq(scenes.projectId, projectId))
				: await db
						.select({ totalPublished: count(scenePublished.sceneId) })
						.from(scenePublished)
						.innerJoin(scenes, eq(scenes.id, scenePublished.sceneId))
						.innerJoin(projects, eq(projects.id, scenes.projectId))
						.where(eq(projects.organizationId, project.organizationId))

			/*
			  `getQuotaLimit`, not `checkQuota`. The count above already is the
			  usage, and checkQuota's usage side reads counters nothing writes, so
			  the `hard_limit_exceeded` branch that used to be OR'd in here could
			  never fire. This gate worked only because of the row count.
			*/
			const { limit } = await getQuotaLimit(
				project.organizationId,
				'scenes_published_concurrent'
			)

			if (limit !== null && totalPublished >= limit) {
				const upgradeTo = getRecommendedUpgrade(effectivePlan)
				throw new QuotaExceededError({
					limitKey: 'scenes_published_concurrent',
					currentValue: totalPublished,
					limit,
					plan: effectivePlan,
					upgradeTo,
					message: useProjectScopedLimit
						? 'Free plan limit reached: you can publish up to 3 scenes concurrently in this project.'
						: 'Published scene limit reached for your plan. Upgrade to publish more scenes concurrently.'
				})
			}
		}

		const result = await sceneSettingsService.publishSceneFromAssetId({
			sceneId,
			projectId,
			userId,
			publishedAssetId,
			currentSceneBytes
		})
		// Only reached when the publish landed, so this is the one asset the
		// reclaim must leave alone.
		keepAssetIds = [publishedAssetId]
		const stats = await sceneSettingsService.getSceneStats(sceneId)

		return ApiResponse.success({ ...result, sceneId, stats })
	} catch (error) {
		/*
		  As in the three upload operations above, and for the reason recorded on
		  `isRoutableDomainError`. Two things are specific to this one.

		  The rethrow goes above `reportServerError`, because an organization
		  reaching its concurrent-publish limit is the guard working: reporting it
		  would file one exception per refusal. Untagged, at that - this call site
		  passes no `request`, so `on_critical_path` would be false and no alert
		  would fire on it either way.

		  And this is the only one of the four reached through
		  `runWithIdempotentSceneRequest`, which awaits its operation unguarded and
		  so cannot record the outcome of a throw. The reservation is left
		  `pending` rather than moved to `failed`. Nothing user-facing turns on it
		  - both states answer a same-key retry with the same 409, and the client
		  mints a fresh request id per attempt - so it is filed rather than fixed
		  here, in the route file this change does not otherwise touch.
		*/
		if (isRoutableDomainError(error)) {
			throw error
		}
		reportServerError(error, {
			properties: { sceneId: request.sceneId || null }
		})
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to publish scene'
		)
	} finally {
		if (reclaimProjectId) {
			await reclaimUploadBatch({
				requestId: request.requestId,
				projectId: reclaimProjectId,
				keepAssetIds
			})
		}
	}
}

export async function revokeScenePublish(
	request: SceneSettingsRequest,
	userId: string
): Promise<Response> {
	try {
		const { sceneId } = request as GetSceneSettingsRequest
		assertParsed(
			sceneId,
			'Scene settings request must be validated before calling operations'
		)

		const hasUser = await userExists(userId)
		if (!hasUser) {
			throw new Error(
				'User not found in local database. Please sign out and sign back in.'
			)
		}

		await getSceneProjectId(sceneId)

		const result = await sceneSettingsService.revokeScenePublication({
			sceneId,
			userId
		})

		return ApiResponse.success(result)
	} catch (error) {
		reportServerError(error, {
			properties: { sceneId: request.sceneId || null }
		})
		return ApiResponse.serverError(
			error instanceof Error
				? error.message
				: 'Failed to revoke scene publication'
		)
	}
}
