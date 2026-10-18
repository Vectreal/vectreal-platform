import { and, eq, inArray } from 'drizzle-orm'

import { updateSceneMetadata } from './scene-folder-repository.server'
import { compareAssetIds } from './scene-settings-assets.server'
import { findNewRemoteArtwork } from '../hotspot-artwork'
import { isUrlServedSceneAsset } from '../scene-asset-roles'
import {
	getHotspotsBySceneSettingsId,
	getSceneAssetLinks,
	getSceneSettingsBySceneId,
	getSceneSettingsWithAssetsRow,
	replaceHotspots,
	replaceSceneAssets,
	rowToSceneSettings,
	type SceneSettingsTransaction,
	upsertSceneSettings
} from './scene-settings-repository.server'
import { getDbClient } from '../../../../db/client'
import {
	assets,
	folders,
	sceneAssets,
	sceneFolders,
	scenePublished,
	scenes,
	sceneSettings,
	sceneStats
} from '../../../../db/schema'
import {
	SceneAssetBinaryDataMap,
	SaveSceneSettingsParams,
	UpdateSceneSettingsParams
} from '../../../../types/api'
import { reportServerError } from '../../../observability/report-server-error.server'
import {
	createSceneStatsFromReport,
	resolveInitialSceneBytes,
	resolveTextureByteMetricsScope
} from '../../../utils/scene-stats-helpers'
import {
	deleteAssets,
	downloadAsset,
	downloadAssets,
	selectUnreferencedAssetIds
} from '../../asset/asset-storage.server'
import { optimizationsMatch } from '../client/optimization-inference'
import { describePublishSource } from '../publish-source'
import { haveSceneSettingsChanged } from '../scene-settings-comparison'

import type { SceneMetaState } from '../../../../types/publisher-config'
import type {
	ExtendedGLTFDocument,
	OptimizationReport,
	Optimizations
} from '@vctrl/core'

/** What publishing the saved scene would be made from; see `describePublishSource`. */
async function readPublishSource(
	tx: SceneSettingsTransaction,
	sceneId: string
): Promise<string | null> {
	const saved = await getSceneSettingsWithAssetsRow(tx, sceneId)
	if (!saved) return null

	const [stats] = await tx
		.select({ optimizationSettings: sceneStats.optimizationSettings })
		.from(sceneStats)
		.where(eq(sceneStats.sceneId, sceneId))
		.limit(1)

	return describePublishSource({
		assets: saved.assets,
		optimizationSettings: stats?.optimizationSettings,
		presentation: saved.settings.presentation
	})
}

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
	 * The stored size of an asset the project owns. Refuses an asset from any
	 * other project, as `assertAssetsBelongToProject` does, so its size is never
	 * reported to a caller who could not publish it. A row from before sizes
	 * were recorded reads as 0.
	 */
	async getPublishedAssetBytes(
		assetId: string,
		projectId: string
	): Promise<number> {
		await this.assertAssetsBelongToProject([assetId], projectId)
		const [record] = await this.db
			.select({ fileSize: assets.fileSize })
			.from(assets)
			.where(eq(assets.id, assetId))
			.limit(1)
		return record?.fileSize ?? 0
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

	async getExistingAssetHashes(
		sceneId: string
	): Promise<Record<string, { assetId: string; contentHash: string }>> {
		const settingsRows = await this.db
			.select({ id: sceneSettings.id })
			.from(sceneSettings)
			.where(eq(sceneSettings.sceneId, sceneId))
			.limit(1)

		if (settingsRows.length === 0) return {}

		const sceneAssetRows = await this.db
			.select({ assetId: sceneAssets.assetId })
			.from(sceneAssets)
			.where(eq(sceneAssets.sceneSettingsId, settingsRows[0].id))

		const assetIds = sceneAssetRows.map((row) => row.assetId)
		if (assetIds.length === 0) return {}

		/*
		  Ordered, because the loop below keys by `asset.name` and a name is not
		  unique: a save whose garbage collection failed leaves the superseded row
		  beside its replacement. Unordered, which hash survived was whichever row
		  Postgres happened to return last, so the same scene could reuse an asset
		  on one save and re-upload it on the next with nothing having changed.
		*/
		const assetRecords = await this.db
			.select({ id: assets.id, name: assets.name, metadata: assets.metadata })
			.from(assets)
			.where(inArray(assets.id, assetIds))
			.orderBy(assets.createdAt, assets.id)

		const result: Record<string, { assetId: string; contentHash: string }> = {}
		for (const asset of assetRecords) {
			const metadata = asset.metadata as { contentHash?: string } | null
			if (metadata?.contentHash) {
				result[asset.name] = {
					assetId: asset.id,
					contentHash: metadata.contentHash
				}
			}
		}
		return result
	}

	async saveSceneSettingsFromAssetIds(
		params: Omit<SaveSceneSettingsParams, 'gltfJson'> & {
			sceneAssetIds: string[]
			/** The kept original. Left out, any original the scene had is unlinked. */
			sourceAssetId?: string | null
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
			sourceAssetId = null,
			optimizationReport,
			optimizationSettings,
			initialSceneBytes
		} = params
		// Every id the scene will link, the original included, so dropping the
		// original reads as a change and leaves it to the GC below.
		const linkedAssetIds = sourceAssetId
			? [...sceneAssetIds, sourceAssetId]
			: sceneAssetIds

		await this.assertAssetsBelongToProject(linkedAssetIds, projectId)

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
			const existingLinks = existingSettings
				? await getSceneAssetLinks(tx, existingSettings.id)
				: { assetIds: [], sourceAssetId: null }
			const existingAssetIds = existingLinks.assetIds
			const existingHotspots = existingSettings
				? await getHotspotsBySceneSettingsId(tx, existingSettings.id)
				: []

			// Read against the stored rows in the same transaction, so the
			// grandfathered value is the one this save would overwrite.
			const remoteArtwork = findNewRemoteArtwork(
				settings.hotspots,
				existingHotspots
			)
			if (remoteArtwork) {
				throw new SceneSaveRefusedError(
					`Marker "${remoteArtwork.name.trim()}" links artwork from another site. Upload the image instead (payloadUrl)`
				)
			}

			const settingsChanged = existingSettings
				? haveSceneSettingsChanged(settings, existingSettings, existingHotspots)
				: true
			// The same ids can still change roles: a model asset kept as the
			// original, or the reverse, has to be relinked.
			const assetsChanged =
				compareAssetIds(linkedAssetIds, existingAssetIds) ||
				existingLinks.sourceAssetId !== sourceAssetId

			/*
			  Draco and the GPU texture default are applied at publish, so a pass
			  that changes only those rebuilds a byte-identical document: same
			  assets, same settings. Its settings still change what publish ships,
			  and `describePublishSource` reads them from the stats, so the save
			  has to write them.
			*/
			const [existingStats] = optimizationSettings
				? await tx
						.select({ optimizationSettings: sceneStats.optimizationSettings })
						.from(sceneStats)
						.where(eq(sceneStats.sceneId, sceneId))
						.limit(1)
				: []
			const optimizationSettingsChanged =
				optimizationSettings !== undefined &&
				!(
					existingStats?.optimizationSettings &&
					optimizationsMatch(
						optimizationSettings,
						existingStats.optimizationSettings
					)
				)

			if (
				existingSettings &&
				!settingsChanged &&
				!assetsChanged &&
				!optimizationSettingsChanged &&
				!hasLocationChange
			) {
				return { ...existingSettings, unchanged: true }
			}

			// Assets this scene no longer links (superseded bake/thumbnail, textures
			// dropped by a model change). Candidates for GC once the new links commit.
			const newAssetIdSet = new Set(linkedAssetIds)
			const removedAssetIds = existingAssetIds.filter(
				(id) => !newAssetIdSet.has(id)
			)

			const savedSettings = await upsertSceneSettings(tx, {
				sceneId: updatedScene.id,
				createdBy: userId,
				settings
			})

			if (!existingSettings || assetsChanged) {
				await replaceSceneAssets(
					tx,
					savedSettings.id,
					sceneAssetIds,
					sourceAssetId
				)
			}

			// Always sync hotspots - the client is authoritative on the full list.
			await replaceHotspots(tx, savedSettings.id, settings.hotspots ?? [])

			if (optimizationReport || optimizationSettings) {
				await this.upsertSceneStats(tx, {
					report: optimizationReport,
					optimizationSettings,
					sceneId: updatedScene.id,
					userId,
					initialSceneBytes,
					label: 'latest',
					description: 'Latest scene statistics'
				})
			}

			return { savedSettings, unchanged: false as const, removedAssetIds }
		})

		await this.updateSceneAggregateMetadata(sceneId, userId, meta)

		if ('unchanged' in saveResult && saveResult.unchanged) {
			return saveResult
		}

		// Post-commit so storage deletes stay out of the DB transaction.
		await this.garbageCollectUnreferencedAssets(
			saveResult.removedAssetIds ?? []
		)

		return saveResult.savedSettings
	}

	/**
	 * Deletes assets that were unlinked from a scene and are no longer referenced by
	 * ANY scene (storage object + DB row). Best-effort and post-commit: a GC failure
	 * never fails the save. The cross-scene reference check guards assets shared via
	 * the project's dedup folder (e.g. an identical texture used by another scene).
	 */
	private async garbageCollectUnreferencedAssets(candidateAssetIds: string[]) {
		if (candidateAssetIds.length === 0) return

		try {
			// Asks every reference path, not just `scene_assets`. Checking that one
			// alone is what deleted scene thumbnails: they are referenced by
			// `scenes.thumbnail_url`, which joins to nothing.
			const orphaned = await selectUnreferencedAssetIds(candidateAssetIds)

			if (orphaned.length > 0) {
				await deleteAssets(orphaned)
			}
		} catch (error) {
			console.warn('[scene-settings] unreferenced asset GC failed', {
				candidateCount: candidateAssetIds.length,
				error
			})
		}
	}

	/**
	 * Retrieves the latest scene settings for a scene.
	 * Downloads assets from cloud storage and returns them with scene settings.
	 * @param sceneId - The scene ID
	 * @returns Latest scene settings with associated assets and asset data
	 */
	async getSceneSettingsWithAssets(sceneId: string) {
		let result: Awaited<ReturnType<typeof getSceneSettingsWithAssetsRow>>
		let hotspots: import('@vctrl/core').HotspotDefinition[] = []

		try {
			result = await this.db.transaction(async (tx) => {
				const row = await getSceneSettingsWithAssetsRow(tx, sceneId)
				if (row) {
					hotspots = await getHotspotsBySceneSettingsId(tx, row.settings.id)
				}
				return row
			})
		} catch (error) {
			reportServerError(error, { properties: { sceneId } })
			return null
		}

		if (!result) return null

		const { settings, assets: sceneAssetsData } = result

		// Extract asset IDs to download into the manifest. The thumbnail and marker
		// artwork are tracked as scene assets (for GC) but served by URL, not
		// rendered, so they are excluded from the inlined render data.
		const assetIds = sceneAssetsData
			.filter((asset) => !isUrlServedSceneAsset(asset))
			.map((asset) => asset.id)

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
				// Continues without asset data rather than failing completely, so
				// the caller renders a scene that is quietly missing pieces.
				reportServerError(error, { properties: { sceneId } })
			}
		}

		return {
			meta: await this.getSceneMetadata(sceneId),
			settings: rowToSceneSettings(settings, hotspots),
			assets: sceneAssetsData,
			assetDataMap, // Map of assetId -> asset data for reconstruction
			gltfJson // The parsed GLTF JSON document
		}
	}

	/**
	 * Retrieves the latest scene settings plus asset metadata only.
	 * Downloads just the glTF JSON asset; binary assets are served by
	 * reference through the scene asset endpoint instead of being inlined.
	 */
	/**
	 * `includeGltfJson` is opt-out because the embed manifest never sends the
	 * editor glTF document, and downloading plus parsing it would be a storage
	 * round-trip per embed load for bytes that are then discarded.
	 *
	 * `readErrors: 'throw'` lets a caller tell a failed read from a scene that
	 * has no settings; by default a failure is reported and reads as null.
	 */
	async getSceneSettingsWithAssetRefs(
		sceneId: string,
		options: { includeGltfJson?: boolean; readErrors?: 'report' | 'throw' } = {}
	) {
		const { includeGltfJson = true, readErrors = 'report' } = options
		let result: Awaited<ReturnType<typeof getSceneSettingsWithAssetsRow>>
		let hotspots: import('@vctrl/core').HotspotDefinition[] = []

		try {
			result = await this.db.transaction(async (tx) => {
				const row = await getSceneSettingsWithAssetsRow(tx, sceneId)
				if (row) {
					hotspots = await getHotspotsBySceneSettingsId(tx, row.settings.id)
				}
				return row
			})
		} catch (error) {
			if (readErrors === 'throw') throw error
			reportServerError(error, { properties: { sceneId } })
			return null
		}

		if (!result) return null

		const { settings, assets: sceneAssetsData } = result

		let gltfJson: ExtendedGLTFDocument | null = null
		const gltfAsset = includeGltfJson
			? sceneAssetsData.find((asset) => asset.mimeType === 'model/gltf+json')
			: undefined

		if (gltfAsset) {
			try {
				const gltfAssetData = await downloadAsset(gltfAsset.id)
				gltfJson = JSON.parse(
					new TextDecoder().decode(gltfAssetData.data)
				) as ExtendedGLTFDocument
			} catch (error) {
				reportServerError(error, {
					properties: { sceneId, assetId: gltfAsset.id }
				})
			}
		}

		return {
			meta: await this.getSceneMetadata(sceneId),
			settings: rowToSceneSettings(settings, hotspots),
			settingsUpdatedAt: settings.updatedAt ?? null,
			assets: sceneAssetsData,
			sourceAsset: result.sourceAsset,
			gltfJson
		}
	}

	/** Asset metadata for a scene without downloading any bytes. */
	async getSceneAssetRecords(sceneId: string) {
		try {
			const result = await this.db.transaction((tx) =>
				getSceneSettingsWithAssetsRow(tx, sceneId)
			)
			return result?.assets ?? []
		} catch (error) {
			reportServerError(error, { properties: { sceneId } })
			return []
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

	async publishSceneFromAssetId(params: {
		sceneId: string
		projectId: string
		userId: string
		publishedAssetId: string
	}) {
		const { sceneId, projectId, userId, publishedAssetId } = params

		await this.assertAssetsBelongToProject([publishedAssetId], projectId)

		const published = await this.db.transaction(async (tx) => {
			const latestSettings = await getSceneSettingsBySceneId(tx, sceneId)

			// Captured before the delete: once the row is gone the outgoing GLB has
			// no reference left anywhere, so nothing would ever collect it.
			const [outgoing] = await tx
				.select({ assetId: scenePublished.assetId })
				.from(scenePublished)
				.where(eq(scenePublished.sceneId, sceneId))
				.limit(1)

			// Publish saves first whenever anything is unsaved, so the saved scene is
			// what this GLB was exported from.
			const sourceFingerprint = await readPublishSource(tx, sceneId)

			await tx.delete(scenePublished).where(eq(scenePublished.sceneId, sceneId))

			const [publishedRecord] = await tx
				.insert(scenePublished)
				.values({
					sceneId,
					assetId: publishedAssetId,
					sceneSettingsId: latestSettings?.id,
					sourceFingerprint,
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

			const [assetRecord] = await tx
				.select()
				.from(assets)
				.where(eq(assets.id, publishedAssetId))
				.limit(1)

			/*
			  The scene's size is the GLB it now publishes, as stored. Written on
			  its own: the save-time upsert would also overwrite what the last
			  save recorded, the optimization settings among it, with nothing.
			*/
			const currentSceneBytes = assetRecord?.fileSize ?? null
			await tx
				.insert(sceneStats)
				.values({ sceneId, createdBy: userId, currentSceneBytes })
				.onConflictDoUpdate({
					target: sceneStats.sceneId,
					set: { currentSceneBytes, updatedAt: new Date() }
				})

			return {
				record: { ...publishedRecord, asset: assetRecord ?? null },
				previousAssetId: outgoing?.assetId ?? null
			}
		})

		// No same-id special case: republishing byte-identical content dedupes to
		// the row we just re-published, so `selectUnreferencedAssetIds` sees the
		// new `scene_published` row and reports it as still referenced. Guarding
		// on `previousAssetId !== publishedAssetId` here would put a second copy
		// of that rule in front of the one function that owns it.
		if (published.previousAssetId) {
			await this.garbageCollectUnreferencedAssets([published.previousAssetId])
		}

		return published.record
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

			// The size was the published GLB's, and there is none now.
			await tx
				.update(sceneStats)
				.set({ currentSceneBytes: null, updatedAt: new Date() })
				.where(eq(sceneStats.sceneId, sceneId))

			return publishedRecord?.assetId ?? null
		})

		// Reference-checked, because uploads are content-addressed and reused: the
		// GLB this scene published can be the same row another scene published.
		// `scene_published.asset_id` is ON DELETE CASCADE, so deleting it
		// unconditionally would cascade that scene's publish row away with it.
		if (publishedAssetId) {
			await this.garbageCollectUnreferencedAssets([publishedAssetId])
		}

		return {
			sceneId,
			status: 'draft' as const,
			revoked: true as const
		}
	}

	/**
	 * Retrieves scene stats for a specific scene.
	 * @param sceneId - The scene ID
	 * @returns Scene stats record
	 */
	async getSceneStats(sceneId: string) {
		return this.db.transaction(async (tx) => {
			const [stats] = await tx
				.select()
				.from(sceneStats)
				.where(eq(sceneStats.sceneId, sceneId))
				.limit(1)
			if (!stats) return null

			const [published] = await tx
				.select({ sourceFingerprint: scenePublished.sourceFingerprint })
				.from(scenePublished)
				.where(eq(scenePublished.sceneId, sceneId))
				.limit(1)

			/*
			  Read beside the published size, because both describe the published
			  file: whether publishing again would ship something else. Null when
			  nothing is published, or when the row predates the fingerprint and
			  so cannot say.
			*/
			const publishedIsCurrent = published?.sourceFingerprint
				? published.sourceFingerprint === (await readPublishSource(tx, sceneId))
				: null

			return { ...stats, publishedIsCurrent }
		})
	}

	// Private helper methods

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

	private async upsertSceneStats(
		tx: SceneSettingsTransaction,
		params: {
			report?: OptimizationReport
			optimizationSettings?: Optimizations
			sceneId: string
			userId: string
			initialSceneBytes?: number | null
			label?: string
			description?: string
		}
	) {
		const existingStats = await tx
			.select({
				baseline: sceneStats.baseline,
				initialSceneBytes: sceneStats.initialSceneBytes,
				additionalMetrics: sceneStats.additionalMetrics
			})
			.from(sceneStats)
			.where(eq(sceneStats.sceneId, params.sceneId))
			.limit(1)

		const existingBaseline = existingStats[0]?.baseline ?? null
		const existingAdditionalMetrics =
			(existingStats[0]?.additionalMetrics as
				| {
						initialTextureBytes?: number | null
						currentTextureBytes?: number | null
				  }
				| null
				| undefined) ?? null

		const initialSceneBytes = resolveInitialSceneBytes({
			existingInitialSceneBytes: existingStats[0]?.initialSceneBytes,
			requestInitialSceneBytes: params.initialSceneBytes,
			report: params.report
		})

		const textureByteMetrics = resolveTextureByteMetricsScope(
			params.report,
			existingAdditionalMetrics
		)

		if (params.report) {
			const statsData = createSceneStatsFromReport(
				params.report,
				params.sceneId,
				params.userId,
				{
					label: params.label,
					description: params.description,
					initialSceneBytes,
					optimizationSettings: params.optimizationSettings,
					existingAdditionalMetrics
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
						initialSceneBytes,
						appliedOptimizations: statsData.appliedOptimizations,
						optimizationSettings: statsData.optimizationSettings,
						additionalMetrics: textureByteMetrics,
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
				initialSceneBytes,
				additionalMetrics: textureByteMetrics,
				optimizationSettings: params.optimizationSettings ?? null
			})
			.onConflictDoUpdate({
				target: sceneStats.sceneId,
				set: {
					label: params.label,
					description: params.description,
					initialSceneBytes,
					additionalMetrics: textureByteMetrics,
					optimizationSettings: params.optimizationSettings ?? null,
					updatedAt: new Date()
				}
			})
	}

	/**
	 * Extract asset data from GLTFExportResult (with separate assets)
	 */

	/**
	 * Extract asset IDs from already processed GLTF JSON with asset references
	 */

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

/**
 * A save refused for something the author can correct, answered as a 400
 * naming what to fix rather than as a failure of the save itself.
 */
export class SceneSaveRefusedError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'SceneSaveRefusedError'
	}
}

export const sceneSettingsService = new SceneSettingsService()
