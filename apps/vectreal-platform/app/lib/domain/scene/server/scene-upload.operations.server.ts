import { ApiResponse } from '@shared/utils'
import { readGlbExtensionsUsed } from '@vctrl/core/model-loader'
import { count, eq } from 'drizzle-orm'

import { resolveSceneAndProject } from './scene-operation-context.server'
import { sceneSettingsService } from './scene-settings-service.server'
import { isBillingStateReadOnly } from '../../../../constants/plan-config'
import { getDbClient } from '../../../../db/client'
import { projects } from '../../../../db/schema/project/projects'
import { scenes } from '../../../../db/schema/project/scenes'
import { uploadSceneAssets } from '../../asset/asset-storage.server'
import {
	EntitlementRequiredError,
	isRoutableDomainError
} from '../../billing/entitlement-required-error'
import {
	hasEntitlement,
	getRecommendedUpgrade
} from '../../billing/entitlement-service.server'
import { assertWithinQuota } from '../../billing/quota-enforcement.server'
import { getProject } from '../../project/project-repository.server'
import {
	getOrCreateDefaultOrganization,
	userExists
} from '../../user/user-repository.server'
import { STUDIO_FINISH_FILENAME } from '../scene-asset-roles'

import type { EntitlementKey } from '../../../../constants/plan-config'
import type { SceneSettingsRequest } from '../../../../types/api'

type UploadPreparedScene = {
	sceneId: string
	projectId: string
	existingAssets: Record<string, { assetId: string; contentHash: string }>
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
					type: kind,
					// A studio finish loads as a model of its own, so it records the
					// extensions it uses the way a published GLB does: a model that
					// records none is loaded without the decoders it needs.
					...(file.name === STUDIO_FINISH_FILENAME
						? { metadata: { gltfExtensionsUsed: readGlbExtensionsUsed(bytes) } }
						: {})
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

/**
 * Stores the GLB a publish will point at, with the extensions it uses
 * recorded on the row: the embed reads them to load only the decoders the
 * file needs. Linked to nothing until the publish commits, so `requestId`
 * names the batch a failed publish reclaims.
 */
export async function storePublishedGlb(params: {
	sceneId: string
	userId: string
	projectId: string
	bytes: Uint8Array
	fileName?: string
	mimeType?: string
	requestId?: string
}) {
	const [uploadResult] = await uploadSceneAssets(
		params.sceneId,
		params.userId,
		params.projectId,
		[
			{
				fileName: params.fileName ?? 'scene.glb',
				data: params.bytes,
				mimeType: params.mimeType ?? 'model/gltf-binary',
				type: 'buffer',
				metadata: { gltfExtensionsUsed: readGlbExtensionsUsed(params.bytes) }
			}
		],
		params.requestId
	)
	return uploadResult
}

export async function uploadPublishedGlb(
	request: SceneSettingsRequest,
	userId: string,
	file: File
): Promise<Response> {
	try {
		const { sceneId, projectId } = await prepareSceneUpload(request, userId)
		const uploadResult = await storePublishedGlb({
			sceneId,
			userId,
			projectId,
			bytes: new Uint8Array(await file.arrayBuffer()),
			fileName: file.name || 'scene.glb',
			mimeType: file.type || 'model/gltf-binary',
			requestId: request.requestId
		})

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
