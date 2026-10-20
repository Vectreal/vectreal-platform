import { ApiResponse } from '@shared/utils'
import { count, eq } from 'drizzle-orm'

import { assertParsed } from './scene-operation-context.server'
import { sceneSettingsService } from './scene-settings-service.server'
import {
	isBillingStateReadOnly,
	type EntitlementKey,
	type Plan
} from '../../../../constants/plan-config'
import { getDbClient, type DbExecutor } from '../../../../db/client'
import { projects } from '../../../../db/schema/project/projects'
import { scenePublished } from '../../../../db/schema/project/scene-published'
import { scenes } from '../../../../db/schema/project/scenes'
import { reportServerError } from '../../../observability/report-server-error.server'
import { reclaimUploadBatch } from '../../asset/asset-reclaim.server'
import { billingRefusalResponse } from '../../billing/billing-refusal-response'
import {
	EntitlementRequiredError,
	isRoutableDomainError
} from '../../billing/entitlement-required-error'
import {
	hasEntitlement,
	getRecommendedUpgrade,
	getQuotaLimit
} from '../../billing/entitlement-service.server'
import { assertWithinQuota } from '../../billing/quota-enforcement.server'
import { QuotaExceededError } from '../../billing/quota-exceeded-error'
import { getProject } from '../../project/project-repository.server'
import { userExists } from '../../user/user-repository.server'

import type { GetSceneSettingsRequest } from './scene-settings.operations.server'
import type { SceneSettingsRequest } from '../../../../types/api'

type PublishSceneRequest = SceneSettingsRequest & {
	sceneId: string
	publishedAssetId: string
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
 * The plan and billing state allow publishing in this organization, or an
 * `EntitlementRequiredError` saying which of the two is missing. Read-only
 * billing is a payment, not an upgrade, so its message says so; the response
 * mapping (`billingRefusalResponse`, `agentBillingRefusal`) picks the status.
 */
export async function requirePublishEntitlement(organizationId: string) {
	const entitlementKey: EntitlementKey = 'scene_publish'
	const decision = await hasEntitlement(organizationId, entitlementKey)
	if (!decision.granted) {
		throw new EntitlementRequiredError({
			entitlementKey,
			plan: decision.effectivePlan,
			billingState: decision.billingState,
			upgradeTo: getRecommendedUpgrade(decision.effectivePlan),
			message: isBillingStateReadOnly(decision.billingState)
				? 'Publishing is unavailable: payment required to restore access.'
				: 'Publishing is not available on your current plan.'
		})
	}
	return decision
}

/**
 * The plan limits a publish must stay within, measured on `executor` so a
 * caller holding a transaction reads them there: the concurrent-publish count
 * (only when the scene is not already published) and the per-scene size of
 * the stored GLB. Throws `QuotaExceededError`.
 */
export async function assertPublishLimits(
	executor: DbExecutor,
	params: {
		sceneId: string
		projectId: string
		organizationId: string
		effectivePlan: Plan
		publishedAssetId: string
	}
): Promise<void> {
	const {
		sceneId,
		projectId,
		organizationId,
		effectivePlan,
		publishedAssetId
	} = params

	const [existingPublish] = await executor
		.select({ sceneId: scenePublished.sceneId })
		.from(scenePublished)
		.where(eq(scenePublished.sceneId, sceneId))
		.limit(1)

	// Enforce concurrent publish quota only when this scene is not already published.
	if (!existingPublish) {
		const useProjectScopedLimit = effectivePlan === 'free'
		const [{ totalPublished }] = useProjectScopedLimit
			? await executor
					.select({ totalPublished: count(scenePublished.sceneId) })
					.from(scenePublished)
					.innerJoin(scenes, eq(scenes.id, scenePublished.sceneId))
					.where(eq(scenes.projectId, projectId))
			: await executor
					.select({ totalPublished: count(scenePublished.sceneId) })
					.from(scenePublished)
					.innerJoin(scenes, eq(scenes.id, scenePublished.sceneId))
					.innerJoin(projects, eq(projects.id, scenes.projectId))
					.where(eq(projects.organizationId, organizationId))

		/*
		  `getQuotaLimit`, not a usage counter: the count above already is the
		  usage. The `checkQuota` branch that used to be OR'd in here read
		  counters nothing wrote, so its `hard_limit_exceeded` case could never
		  fire and this gate worked only because of the row count. That helper
		  is deleted; the limit side, which reads plan config and per-org
		  overrides, is the half that always worked.
		*/
		const { limit } = await getQuotaLimit(
			organizationId,
			'scenes_published_concurrent',
			executor
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

	/*
	  The plan's scene size limits the published GLB, which is what a visitor
	  downloads, at the size the server stored it. The client used to report
	  the figure, and it reported whichever size it had measured last.
	*/
	const publishedBytes = await sceneSettingsService.getPublishedAssetBytes(
		publishedAssetId,
		projectId,
		executor
	)
	await assertWithinQuota({
		organizationId,
		limitKey: 'storage_bytes_per_scene',
		measure: async () => publishedBytes,
		// The measurement is the file itself, not a count it would add to.
		adds: 0,
		message: () =>
			'Scene exceeds the maximum size for your plan. Optimize further or upgrade.',
		executor
	})
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
		const { sceneId, publishedAssetId } = request as PublishSceneRequest
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

		// Returned rather than thrown: the route's request guard records an
		// outcome only for a returned response, and leaves a thrown one pending.
		const entitlement = await requirePublishEntitlement(
			project.organizationId
		).catch((error: unknown) => {
			const refusal = billingRefusalResponse(error)
			if (!refusal) throw error
			return refusal
		})
		if (entitlement instanceof Response) return entitlement
		const { effectivePlan } = entitlement

		await assertPublishLimits(getDbClient(), {
			sceneId,
			projectId,
			organizationId: project.organizationId,
			effectivePlan,
			publishedAssetId
		})

		const result = await sceneSettingsService.publishSceneFromAssetId({
			sceneId,
			projectId,
			userId,
			publishedAssetId
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
