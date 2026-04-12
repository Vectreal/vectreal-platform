import { JSONDocument } from '@gltf-transform/core'
import { and, eq, inArray } from 'drizzle-orm'

import { updateSceneMetadata } from './scene-folder-repository.server'
import {
	buildExtendedGltfDocument,
	buildGltfJsonAsset,
	compareAssetHashes,
	compareAssetIds,
	computeAssetHashes,
	extractAssetIdsFromGltf,
	extractGltfAssets,
	isGltfExportResult
} from './scene-settings-assets.server'
import {
	getSceneAssetIds,
	getSceneSettingsBySceneId,
	getSceneSettingsWithAssetsRow,
	replaceSceneAssets,
	type SceneSettingsTransaction,
	upsertSceneSettings
} from './scene-settings-repository.server'
import { getDbClient } from '../../../../db/client'
import {
	assets,
	folders,
	organizations,
	permissions,
	projects,
	sceneFolders,
	scenePublished,
	scenes,
	sceneSettings,
	sceneStats
} from '../../../../db/schema'
import {
	type GLTFExportResult,
	SceneAssetBinaryDataMap,
	SaveSceneSettingsParams,
	UpdateSceneSettingsParams
} from '../../../../types/api'
import { createSceneStatsFromReport } from '../../../utils/scene-stats-helpers'
import {
	deleteAssets,
	downloadAssets,
	uploadSceneAssets
} from '../../asset/asset-storage.server'

import type { SceneMetaState } from '../../../../types/publisher-config'
import type {
	ExtendedGLTFDocument,
	OptimizationReport,
	Optimizations,
	SceneSettings
} from '@vctrl/core'

/**
 * Data service for scene settings operations.
 * Focuses purely on data access and manipulation.
 */
class SceneSettingsService {
	private readonly db = getDbClient()

	async assertAssetsBelongToProject(
		assetIds: string[],
		projectId: string
	): Promise<void> {
		if (assetIds.length === 0) {
			throw new Error('At least one asset ID is required')
		}

		const records = await this.db
			.select({ assetId: assets.id, projectId: folders.projectId })
			.from(assets)
			.innerJoin(folders, eq(assets.folderId, folders.id))
			.where(inArray(assets.id, assetIds))

		if (records.length !== assetIds.length) {
			throw new Error('One or more uploaded assets are missing')
		}

		if (records.some((record) => record.projectId !== projectId)) {
			throw new Error('Uploaded assets do not belong to the target project')
		}
	}

	/**
	 * Retrieves project ID associated with a scene.
	 * @param sceneId - The scene ID
	 * @returns Project ID or null if scene doesn't exist
	 */
	async getProjectIdFromScene(sceneId: string): Promise<string | null> {
		const scene = await this.db
			.select({ projectId: scenes.projectId })
			.from(scenes)
			.where(eq(scenes.id, sceneId))
			.limit(1)

		return scene.length > 0 ? scene[0].projectId : null
	}

	/**
	 * Creates or updates scene settings for a scene.
	 * @param params - Scene settings creation parameters
	 * @returns Created or updated scene settings
	 */
	async saveSceneSettings(params: SaveSceneSettingsParams) {
		const {
			sceneId,
			projectId,
			targetProjectId,
			targetFolderId,
			userId,
			meta,
			settings,
			gltfJson,
			optimizationReport,
			optimizationSettings,
			initialSceneBytes,
			currentSceneBytes
		} = params

		const saveResult = await this.db.transaction(async (tx) => {
			const scene = await this.ensureSceneExists(tx, {
				sceneId,
				projectId,
				userId,
				sceneMeta: meta,
				preferredFolderId: targetFolderId
			})

			const { updatedScene, hasLocationChange } =
				await this.applyTargetLocation(
					tx,
					scene,
					targetProjectId,
					targetFolderId
				)

			const existingSettings = await getSceneSettingsBySceneId(tx, sceneId)
			const existingAssetIds = existingSettings
				? await getSceneAssetIds(tx, existingSettings.id)
				: []

			const settingsChanged = existingSettings
				? this.compareSceneSettings(settings, existingSettings)
				: true
			const { assetsChanged, reusableAssetIds } =
				await this.determineAssetReuse(gltfJson, existingAssetIds, tx)

			if (
				existingSettings &&
				!settingsChanged &&
				!assetsChanged &&
				!hasLocationChange
			) {
				return { ...existingSettings, unchanged: true }
			}

			const assetIds = await this.resolveAssetIds({
				sceneId: updatedScene.id,
				userId,
				projectId: updatedScene.projectId,
				gltfJson,
				reusableAssetIds
			})

			const savedSettings = await upsertSceneSettings(tx, {
				sceneId: updatedScene.id,
				createdBy: userId,
				settings
			})

			if (!existingSettings || assetsChanged) {
				await replaceSceneAssets(tx, savedSettings.id, assetIds)
			}

			if (optimizationReport || optimizationSettings) {
				await this.upsertSceneStats(tx, {
					report: optimizationReport,
					optimizationSettings,
					sceneId: updatedScene.id,
					userId,
					initialSceneBytes,
					currentSceneBytes,
					label: 'latest',
					description: 'Latest scene statistics'
				})
			}

			return { savedSettings, unchanged: false as const }
		})

		await this.updateSceneAggregateMetadata(sceneId, userId, meta)

		if ('unchanged' in saveResult && saveResult.unchanged) {
			return saveResult
		}

		const savedSettings = saveResult.savedSettings

		return savedSettings
	}

	async saveSceneSettingsFromAssetIds(
		params: Omit<SaveSceneSettingsParams, 'gltfJson'> & {
			sceneAssetIds: string[]
		}
	) {
		const {
			sceneId,
			projectId,
			targetProjectId,
			targetFolderId,
			userId,
			meta,
			settings,
			sceneAssetIds,
			optimizationReport,
			optimizationSettings,
			initialSceneBytes,
			currentSceneBytes
		} = params

		await this.assertAssetsBelongToProject(sceneAssetIds, projectId)

		const saveResult = await this.db.transaction(async (tx) => {
			const scene = await this.ensureSceneExists(tx, {
				sceneId,
				projectId,
				userId,
				sceneMeta: meta,
				preferredFolderId: targetFolderId
			})

			const { updatedScene, hasLocationChange } =
				await this.applyTargetLocation(
					tx,
					scene,
					targetProjectId,
					targetFolderId
				)

			const existingSettings = await getSceneSettingsBySceneId(tx, sceneId)
			const existingAssetIds = existingSettings
				? await getSceneAssetIds(tx, existingSettings.id)
				: []
			const settingsChanged = existingSettings
				? this.compareSceneSettings(settings, existingSettings)
				: true
			const assetsChanged = compareAssetIds(sceneAssetIds, existingAssetIds)

			if (
				existingSettings &&
				!settingsChanged &&
				!assetsChanged &&
				!hasLocationChange
			) {
				return { ...existingSettings, unchanged: true }
			}

			const savedSettings = await upsertSceneSettings(tx, {
				sceneId: updatedScene.id,
				createdBy: userId,
				settings
			})

			if (!existingSettings || assetsChanged) {
				await replaceSceneAssets(tx, savedSettings.id, sceneAssetIds)
			}

			if (optimizationReport || optimizationSettings) {
				await this.upsertSceneStats(tx, {
					report: optimizationReport,
					optimizationSettings,
					sceneId: updatedScene.id,
					userId,
					initialSceneBytes,
					currentSceneBytes,
					label: 'latest',
					description: 'Latest scene statistics'
				})
			}

			return { savedSettings, unchanged: false as const }
		})

		await this.updateSceneAggregateMetadata(sceneId, userId, meta)

		if ('unchanged' in saveResult && saveResult.unchanged) {
			return saveResult
		}

		return saveResult.savedSettings
	}

	/**
	 * Updates existing scene settings in place.
	 * @param params - Update parameters
	 * @returns Updated scene settings
	 */
	async updateSceneSettings(params: UpdateSceneSettingsParams) {
		const { sceneSettingsId, settings, meta, gltfJson, userId } = params

		const updatedSettings = await this.db.transaction(async (tx) => {
			// Get scene info for processing assets
			const [currentSettings] = await tx
				.select()
				.from(sceneSettings)
				.where(eq(sceneSettings.id, sceneSettingsId))
				.limit(1)

			if (!currentSettings) {
				throw new Error('Scene settings not found')
			}

			const [scene] = await tx
				.select()
				.from(scenes)
				.where(eq(scenes.id, currentSettings.sceneId))
				.limit(1)

			if (!scene) {
				throw new Error('Scene not found')
			}

			// Process GLTF if provided
			let processedGltf: ExtendedGLTFDocument | undefined
			if (gltfJson !== undefined) {
				const result = await this.processGLTFExport(
					scene.id,
					currentSettings.createdBy,
					scene.projectId,
					gltfJson
				)
				processedGltf = result.gltfDocument
			}

			// Update settings
			const [updatedSettings] = await tx
				.update(sceneSettings)
				.set({ ...settings })
				.where(eq(sceneSettings.id, sceneSettingsId))
				.returning()

			// Update assets if GLTF was processed
			if (processedGltf !== undefined) {
				await this.updateSceneAssets(tx, sceneSettingsId, processedGltf)
			}

			return updatedSettings
		})

		await this.updateSceneAggregateMetadata(
			updatedSettings.sceneId,
			userId,
			meta
		)

		return updatedSettings
	}

	/**
	 * Retrieves the latest scene settings for a scene.
	 * Downloads assets from cloud storage and returns them with scene settings.
	 * @param sceneId - The scene ID
	 * @returns Latest scene settings with associated assets and asset data
	 */
	async getSceneSettingsWithAssets(sceneId: string) {
		let result: Awaited<ReturnType<typeof getSceneSettingsWithAssetsRow>>

		try {
			result = await this.db.transaction(async (tx) => {
				return await getSceneSettingsWithAssetsRow(tx, sceneId)
			})
		} catch (error) {
			console.error('Failed to query scene settings with assets:', {
				sceneId,
				error
			})
			return null
		}

		if (!result) return null

		const { settings, assets: sceneAssetsData } = result

		// Extract asset IDs
		const assetIds = sceneAssetsData.map((asset) => asset.id)

		// Download asset data from cloud storage
		let gltfJson: ExtendedGLTFDocument | null = null
		let assetDataMap: SceneAssetBinaryDataMap | null = null

		if (assetIds.length > 0) {
			try {
				assetDataMap = await downloadAssets(assetIds)

				// Find and parse the GLTF JSON asset
				const gltfAsset = sceneAssetsData.find(
					(asset) => asset.mimeType === 'model/gltf+json'
				)

				if (gltfAsset && assetDataMap.has(gltfAsset.id)) {
					const gltfAssetData = assetDataMap.get(gltfAsset.id)
					if (gltfAssetData) {
						const jsonString = new TextDecoder().decode(gltfAssetData.data)
						gltfJson = JSON.parse(jsonString) as ExtendedGLTFDocument
					}
				}
			} catch (error) {
				console.error('Failed to download some assets:', error)
				// Continue without asset data rather than failing completely
			}
		}

		return {
			meta: await this.getSceneMetadata(sceneId),
			settings: {
				bounds: settings.bounds ?? undefined,
				camera: settings.camera ?? undefined,
				controls: settings.controls ?? undefined,
				environment: settings.environment ?? undefined,
				shadows: settings.shadows ?? undefined
			},
			assets: sceneAssetsData,
			assetDataMap, // Map of assetId -> asset data for reconstruction
			gltfJson // The parsed GLTF JSON document
		}
	}

	async getSceneMetadata(sceneId: string) {
		const [scene] = await this.db
			.select({
				name: scenes.name,
				description: scenes.description,
				thumbnailUrl: scenes.thumbnailUrl
			})
			.from(scenes)
			.where(eq(scenes.id, sceneId))
			.limit(1)

		if (!scene) {
			return null
		}

		return {
			name: scene.name,
			description: scene.description ?? '',
			thumbnailUrl: scene.thumbnailUrl ?? ''
		}
	}

	/**
	 * Publishes a scene by uploading a GLB and creating a publish record.
	 * @param params - Publish parameters
	 * @returns Published scene record
	 */
	async publishScene(params: {
		sceneId: string
		projectId: string
		userId: string
		publishedGlb: { data: number[]; fileName?: string; mimeType?: string }
		currentSceneBytes?: number
	}) {
		const { sceneId, projectId, userId, publishedGlb, currentSceneBytes } =
			params

		return await this.db.transaction(async (tx) => {
			const latestSettings = await getSceneSettingsBySceneId(tx, sceneId)
			const uploadResult = await this.uploadPublishedGlb(
				sceneId,
				userId,
				projectId,
				publishedGlb
			)

			await tx.delete(scenePublished).where(eq(scenePublished.sceneId, sceneId))

			const [publishedRecord] = await tx
				.insert(scenePublished)
				.values({
					sceneId,
					assetId: uploadResult.assetId,
					sceneSettingsId: latestSettings?.id,
					publishedBy: userId
				})
				.returning()

			await tx
				.update(scenes)
				.set({
					status: 'published',
					updatedAt: new Date()
				})
				.where(eq(scenes.id, sceneId))

			await this.upsertSceneStats(tx, {
				sceneId,
				userId,
				currentSceneBytes: currentSceneBytes ?? publishedGlb.data.length
			})

			return {
				...publishedRecord,
				asset: uploadResult
			}
		})
	}

	async publishSceneFromAssetId(params: {
		sceneId: string
		projectId: string
		userId: string
		publishedAssetId: string
		currentSceneBytes?: number
	}) {
		const { sceneId, projectId, userId, publishedAssetId, currentSceneBytes } =
			params

		await this.assertAssetsBelongToProject([publishedAssetId], projectId)

		return await this.db.transaction(async (tx) => {
			const latestSettings = await getSceneSettingsBySceneId(tx, sceneId)

			await tx.delete(scenePublished).where(eq(scenePublished.sceneId, sceneId))

			const [publishedRecord] = await tx
				.insert(scenePublished)
				.values({
					sceneId,
					assetId: publishedAssetId,
					sceneSettingsId: latestSettings?.id,
					publishedBy: userId
				})
				.returning()

			await tx
				.update(scenes)
				.set({
					status: 'published',
					updatedAt: new Date()
				})
				.where(eq(scenes.id, sceneId))

			await this.upsertSceneStats(tx, {
				sceneId,
				userId,
				currentSceneBytes
			})

			const [assetRecord] = await tx
				.select()
				.from(assets)
				.where(eq(assets.id, publishedAssetId))
				.limit(1)

			return {
				...publishedRecord,
				asset: assetRecord ?? null
			}
		})
	}

	async revokeScenePublication(params: { sceneId: string; userId: string }) {
		const { sceneId } = params

		const publishedAssetId = await this.db.transaction(async (tx) => {
			const [publishedRecord] = await tx
				.select({ assetId: scenePublished.assetId })
				.from(scenePublished)
				.where(eq(scenePublished.sceneId, sceneId))
				.limit(1)

			await tx.delete(scenePublished).where(eq(scenePublished.sceneId, sceneId))

			await tx
				.update(scenes)
				.set({
					status: 'draft',
					updatedAt: new Date()
				})
				.where(eq(scenes.id, sceneId))

			return publishedRecord?.assetId ?? null
		})

		if (publishedAssetId) {
			await deleteAssets([publishedAssetId])
		}

		return {
			sceneId,
			status: 'draft' as const,
			revoked: true as const
		}
	}

	/**
	 * Checks if user has permission for a scene.
	 * @param sceneId - The scene ID
	 * @param userId - The user ID
	 * @param permission - Required permission level
	 * @returns Whether user has the permission
	 */
	async hasScenePermission(
		sceneId: string,
		userId: string,
		permission: 'read' | 'write' | 'admin' | 'delete'
	): Promise<boolean> {
		// Get the scene and its project
		const scene = await this.db
			.select({
				scene: scenes,
				project: projects,
				organization: organizations
			})
			.from(scenes)
			.leftJoin(projects, eq(scenes.projectId, projects.id))
			.leftJoin(organizations, eq(projects.organizationId, organizations.id))
			.where(eq(scenes.id, sceneId))
			.limit(1)

		if (scene.length === 0) return false

		// Check explicit permissions
		const userPermission = await this.db
			.select()
			.from(permissions)
			.where(
				and(
					eq(permissions.resourceType, 'scene'),
					eq(permissions.resourceId, sceneId),
					eq(permissions.entityType, 'user'),
					eq(permissions.entityId, userId),
					eq(permissions.permission, permission)
				)
			)
			.limit(1)

		return userPermission.length > 0
	}

	/**
	 * Retrieves scene stats for a specific scene.
	 * @param sceneId - The scene ID
	 * @returns Scene stats record
	 */
	async getSceneStats(sceneId: string) {
		const stats = await this.db
			.select()
			.from(sceneStats)
			.where(eq(sceneStats.sceneId, sceneId))
			.limit(1)

		return stats.length > 0 ? stats[0] : null
	}

	// Private helper methods

	/**
	 * Detects whether assets have changed by comparing content hashes.
	 * Returns true if assets have changed, false otherwise.
	 * Handles cases where assets are added, removed, or modified.
	 */
	private async detectAssetChanges(
		gltfJson: JSONDocument | GLTFExportResult | undefined,
		existingAssetIds: string[],
		tx: SceneSettingsTransaction
	): Promise<boolean> {
		if (!gltfJson) {
			return false
		}

		if (isGltfExportResult(gltfJson)) {
			// For GLTFExportResult, compare asset content hashes
			const extractedAssets = extractGltfAssets(gltfJson)
			const existingAssetData = await this.getAssetComparisonData(
				existingAssetIds,
				tx
			)

			// Missing hashes means we should re-upload to compute content hashes
			if (existingAssetData.missingHash) {
				return true
			}

			// Check if number of non-GLTF JSON assets changed
			if (extractedAssets.length !== existingAssetData.assetCount) {
				return true
			}

			if (extractedAssets.length > 0) {
				// Compute hashes for current assets
				const currentAssetHashes = computeAssetHashes(extractedAssets)

				// Compare asset hashes - returns true if changed
				return compareAssetHashes(currentAssetHashes, existingAssetData.hashes)
			}
		} else {
			// For extended GLTF document, extract embedded asset IDs and compare
			const currentAssetIds = extractAssetIdsFromGltf(
				gltfJson as ExtendedGLTFDocument
			)
			return compareAssetIds(currentAssetIds, existingAssetIds)
		}

		return false
	}

	private async determineAssetReuse(
		gltfJson: JSONDocument | GLTFExportResult | undefined,
		existingAssetIds: string[],
		tx: SceneSettingsTransaction
	): Promise<{ assetsChanged: boolean; reusableAssetIds: string[] }> {
		const assetsChanged = await this.detectAssetChanges(
			gltfJson,
			existingAssetIds,
			tx
		)

		return {
			assetsChanged,
			reusableAssetIds: assetsChanged ? [] : existingAssetIds
		}
	}

	/**
	 * Compares two scene settings objects for changes.
	 */
	private compareSceneSettings(
		current: SceneSettings,
		existing: typeof sceneSettings.$inferSelect
	): boolean {
		return (
			JSON.stringify(current.bounds) !== JSON.stringify(existing.bounds) ||
			JSON.stringify(current.camera) !== JSON.stringify(existing.camera) ||
			JSON.stringify(current.controls) !== JSON.stringify(existing.controls) ||
			JSON.stringify(current.environment) !==
				JSON.stringify(existing.environment) ||
			JSON.stringify(current.shadows) !== JSON.stringify(existing.shadows)
		)
	}

	/**
	 * Retrieves comparison data for existing assets.
	 * Excludes GLTF JSON assets and tracks missing hashes for re-upload.
	 */
	private async getAssetComparisonData(
		assetIds: string[],
		tx: SceneSettingsTransaction
	): Promise<{
		hashes: Map<string, string>
		assetCount: number
		missingHash: boolean
	}> {
		const hashes = new Map<string, string>()
		let assetCount = 0
		let missingHash = false

		if (assetIds.length === 0) {
			return { hashes, assetCount, missingHash }
		}

		const assetRecords = await tx
			.select({
				name: assets.name,
				metadata: assets.metadata,
				mimeType: assets.mimeType
			})
			.from(assets)
			.where(inArray(assets.id, assetIds))

		for (const asset of assetRecords) {
			if (asset.mimeType === 'model/gltf+json') {
				continue
			}

			assetCount += 1
			const metadata = asset.metadata as { contentHash?: string } | null
			if (!metadata?.contentHash) {
				missingHash = true
				continue
			}
			hashes.set(asset.name, metadata.contentHash)
		}

		return { hashes, assetCount, missingHash }
	}

	/**
	 * Ensures scene exists, creates if necessary.
	 */
	private async ensureSceneExists(
		tx: SceneSettingsTransaction,
		params: {
			sceneId: string
			projectId: string
			userId: string
			sceneMeta?: SceneMetaState
			preferredFolderId?: string | null
		}
	) {
		const existingScene = await tx
			.select()
			.from(scenes)
			.where(eq(scenes.id, params.sceneId))
			.limit(1)

		if (existingScene.length > 0) {
			return existingScene[0]
		}

		// Create new scene
		await this.ensureSceneFolderExists(params.projectId, params.userId, tx)

		const userFolder = await tx
			.select()
			.from(sceneFolders)
			.where(
				and(
					eq(sceneFolders.ownerId, params.userId),
					eq(sceneFolders.projectId, params.projectId)
				)
			)
			.limit(1)

		const [newScene] = await tx
			.insert(scenes)
			.values({
				id: params.sceneId,
				name: params.sceneMeta?.name?.trim() || 'Untitled Scene',
				description:
					params.sceneMeta?.description?.trim() ||
					'Scene created from publisher',
				thumbnailUrl: params.sceneMeta?.thumbnailUrl?.trim() || null,
				projectId: params.projectId,
				folderId: params.preferredFolderId ?? userFolder[0]?.id,
				status: 'draft'
			})
			.returning()

		return newScene
	}

	/**
	 * Applies a target project/folder location to an existing scene row.
	 * If no location fields are provided, or the effective location matches the
	 * current one, the original scene row is returned unchanged.
	 *
	 * @returns The (possibly updated) scene row and whether a DB write occurred.
	 */
	private async applyTargetLocation(
		tx: SceneSettingsTransaction,
		scene: typeof scenes.$inferSelect,
		targetProjectId: string | undefined,
		targetFolderId: string | null | undefined
	): Promise<{
		updatedScene: typeof scenes.$inferSelect
		hasLocationChange: boolean
	}> {
		const shouldApplyTargetLocation =
			typeof targetProjectId !== 'undefined' ||
			typeof targetFolderId !== 'undefined'

		const resolvedTargetProjectId = targetProjectId ?? scene.projectId
		const resolvedTargetFolderId =
			typeof targetFolderId !== 'undefined'
				? targetFolderId
				: targetProjectId && targetProjectId !== scene.projectId
					? null
					: scene.folderId

		const hasLocationChange =
			shouldApplyTargetLocation &&
			(scene.projectId !== resolvedTargetProjectId ||
				scene.folderId !== resolvedTargetFolderId)

		if (!hasLocationChange) {
			return { updatedScene: scene, hasLocationChange: false }
		}

		const [updatedScene] = await tx
			.update(scenes)
			.set({
				projectId: resolvedTargetProjectId,
				folderId: resolvedTargetFolderId,
				updatedAt: new Date()
			})
			.where(eq(scenes.id, scene.id))
			.returning()

		if (!updatedScene) {
			throw new Error('Failed to update scene location')
		}

		return { updatedScene, hasLocationChange: true }
	}

	private async updateSceneAggregateMetadata(
		sceneId: string,
		userId: string,
		meta: SaveSceneSettingsParams['meta'] | UpdateSceneSettingsParams['meta']
	) {
		const trimmedName = meta.name?.trim()
		if (!trimmedName) {
			return
		}

		await updateSceneMetadata(sceneId, userId, {
			name: trimmedName,
			description: meta.description,
			thumbnailUrl: meta.thumbnailUrl
		})
	}

	/**
	 * Resolves asset IDs for a settings save.
	 */
	private async resolveAssetIds(params: {
		sceneId: string
		userId: string
		projectId: string
		gltfJson?: JSONDocument | GLTFExportResult
		reusableAssetIds: string[]
	}): Promise<string[]> {
		const { sceneId, userId, projectId, gltfJson, reusableAssetIds } = params

		if (!gltfJson) {
			return reusableAssetIds
		}

		if (reusableAssetIds.length > 0) {
			return reusableAssetIds
		}

		const processedGltf = await this.processGLTFExport(
			sceneId,
			userId,
			projectId,
			gltfJson
		)

		return processedGltf.assetIds
	}

	private async upsertSceneStats(
		tx: SceneSettingsTransaction,
		params: {
			report?: OptimizationReport
			optimizationSettings?: Optimizations
			sceneId: string
			userId: string
			initialSceneBytes?: number | null
			currentSceneBytes?: number | null
			label?: string
			description?: string
		}
	) {
		const existingStats = await tx
			.select({
				baseline: sceneStats.baseline,
				initialSceneBytes: sceneStats.initialSceneBytes,
				currentSceneBytes: sceneStats.currentSceneBytes
			})
			.from(sceneStats)
			.where(eq(sceneStats.sceneId, params.sceneId))
			.limit(1)

		const existingBaseline = existingStats[0]?.baseline ?? null

		const persistedInitialSceneBytes =
			existingStats[0]?.initialSceneBytes ??
			params.initialSceneBytes ??
			params.report?.originalSize ??
			null
		const persistedCurrentSceneBytes =
			params.currentSceneBytes ??
			params.report?.optimizedSize ??
			existingStats[0]?.currentSceneBytes ??
			null

		if (params.report) {
			const statsData = createSceneStatsFromReport(
				params.report,
				params.sceneId,
				params.userId,
				{
					label: params.label,
					description: params.description,
					initialSceneBytes: persistedInitialSceneBytes,
					currentSceneBytes: persistedCurrentSceneBytes,
					optimizationSettings: params.optimizationSettings
				}
			)

			await tx
				.insert(sceneStats)
				.values(statsData)
				.onConflictDoUpdate({
					target: sceneStats.sceneId,
					set: {
						label: statsData.label,
						description: statsData.description,
						baseline: existingBaseline ?? statsData.baseline,
						optimized: statsData.optimized,
						initialSceneBytes: statsData.initialSceneBytes,
						currentSceneBytes: statsData.currentSceneBytes,
						appliedOptimizations: statsData.appliedOptimizations,
						optimizationSettings: statsData.optimizationSettings,
						additionalMetrics: statsData.additionalMetrics,
						createdBy: params.userId,
						updatedAt: new Date()
					}
				})

			return
		}

		await tx
			.insert(sceneStats)
			.values({
				sceneId: params.sceneId,
				createdBy: params.userId,
				label: params.label,
				description: params.description,
				initialSceneBytes: persistedInitialSceneBytes,
				currentSceneBytes: persistedCurrentSceneBytes,
				optimizationSettings: params.optimizationSettings ?? null
			})
			.onConflictDoUpdate({
				target: sceneStats.sceneId,
				set: {
					label: params.label,
					description: params.description,
					initialSceneBytes: persistedInitialSceneBytes,
					currentSceneBytes: persistedCurrentSceneBytes,
					optimizationSettings: params.optimizationSettings ?? null,
					updatedAt: new Date()
				}
			})
	}

	/**
	 * Extract asset data from GLTFExportResult (with separate assets)
	 */
	/**
	 * Upload GLTF assets to cloud storage and return asset IDs
	 */
	private async uploadGLTFAssets(
		sceneId: string,
		userId: string,
		projectId: string,
		gltfExportResult: GLTFExportResult
	): Promise<string[]> {
		const gltfAssets = extractGltfAssets(gltfExportResult)

		if (gltfAssets.length === 0) {
			return []
		}

		const uploadResults = await uploadSceneAssets(
			sceneId,
			userId,
			projectId,
			gltfAssets
		)

		return uploadResults.map((result) => result.assetId)
	}

	private async uploadPublishedGlb(
		sceneId: string,
		userId: string,
		projectId: string,
		publishedGlb: { data: number[]; fileName?: string; mimeType?: string }
	) {
		const fileName = publishedGlb.fileName || 'scene.glb'
		const mimeType = publishedGlb.mimeType || 'model/gltf-binary'
		const data = new Uint8Array(publishedGlb.data)
		const [result] = await uploadSceneAssets(sceneId, userId, projectId, [
			{
				fileName,
				data,
				mimeType,
				type: 'buffer'
			}
		])

		return result
	}

	/**
	 * Process GLTF export: extract assets, upload to cloud, and create extended GLTF document
	 * with embedded asset IDs for tracking.
	 */
	private async processGLTFExport(
		sceneId: string,
		userId: string,
		projectId: string,
		gltfJson: JSONDocument | GLTFExportResult
	): Promise<{ assetIds: string[]; gltfDocument: ExtendedGLTFDocument }> {
		// Check if this is a GLTFExportResult with separate assets
		if (isGltfExportResult(gltfJson)) {
			// Extract and upload assets
			const assetIds = await this.uploadGLTFAssets(
				sceneId,
				userId,
				projectId,
				gltfJson
			)

			// Upload the GLTF JSON itself as an asset
			const gltfJsonAsset = buildGltfJsonAsset(gltfJson)
			const [gltfJsonUploadResult] = await uploadSceneAssets(
				sceneId,
				userId,
				projectId,
				[gltfJsonAsset]
			)

			// Include the GLTF JSON asset ID in the list
			const allAssetIds = [...assetIds, gltfJsonUploadResult.assetId]

			// Create extended GLTF document with asset IDs embedded
			// Build a mutable object first, then cast to readonly interface
			const baseDoc = gltfJson.data as unknown as ExtendedGLTFDocument
			const extendedGltfDoc = buildExtendedGltfDocument({
				baseDocument: baseDoc,
				assetIds: allAssetIds
			})

			return { assetIds: allAssetIds, gltfDocument: extendedGltfDoc }
		} else {
			// Already a plain JSONDocument - check if it has embedded asset IDs
			const existingAssetIds = extractAssetIdsFromGltf(
				gltfJson as ExtendedGLTFDocument
			)

			return {
				assetIds: existingAssetIds,
				gltfDocument: gltfJson as ExtendedGLTFDocument
			}
		}
	}

	/**
	 * Extract asset IDs from already processed GLTF JSON with asset references
	 */
	/**
	 * Updates assets associated with scene settings.
	 * Processes GLTF export result, uploads assets, and creates database links.
	 */
	private async updateSceneAssets(
		tx: SceneSettingsTransaction,
		sceneSettingsId: string,
		gltfJson: JSONDocument | GLTFExportResult | ExtendedGLTFDocument
	) {
		if (!gltfJson) return

		if (isGltfExportResult(gltfJson)) {
			console.warn(
				'Received GLTFExportResult in updateSceneAssets - should be processed first'
			)
			return
		}

		const assetIds = extractAssetIdsFromGltf(gltfJson as ExtendedGLTFDocument)
		await replaceSceneAssets(tx, sceneSettingsId, assetIds)
	}

	/**
	 * Ensures user has a default scene folder.
	 */
	private async ensureSceneFolderExists(
		projectId: string,
		userId: string,
		tx: SceneSettingsTransaction
	) {
		const existingFolder = await tx
			.select()
			.from(sceneFolders)
			.where(
				and(
					eq(sceneFolders.ownerId, userId),
					eq(sceneFolders.projectId, projectId)
				)
			)
			.limit(1)

		if (existingFolder.length === 0) {
			await tx.insert(sceneFolders).values({
				name: 'My Scenes',
				description: 'Default folder for scenes',
				projectId: projectId,
				ownerId: userId,
				parentFolderId: null
			})
		}
	}
}

export const sceneSettingsService = new SceneSettingsService()
