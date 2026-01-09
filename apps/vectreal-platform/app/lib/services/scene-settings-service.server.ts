import { JSONDocument } from '@gltf-transform/core'
import type { OptimizationReport } from '@vctrl/core'
import { and, desc, eq } from 'drizzle-orm'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'

import { getDbClient } from '../../db/client'
import * as dbSchema from '../../db/schema'
import {
	assets,
	organizations,
	permissions,
	projects,
	sceneAssets,
	sceneFolders,
	scenes,
	sceneSettings,
	sceneStats
} from '../../db/schema'
import {
	CreateSceneSettingsParams,
	type ExtendedGLTFDocument,
	type GLTFExportResult,
	SaveSceneSettingsParams,
	SceneSettingsData,
	type SerializedAsset,
	UpdateSceneSettingsParams
} from '../../types/api'
import { createSceneStatsFromReport } from '../utils/scene-stats-helpers'

import {
	assetStorageService,
	type GLTFAssetData
} from './asset-storage-service.server'

type DbTransaction = PgTransaction<
	PostgresJsQueryResultHKT,
	typeof dbSchema,
	ExtractTablesWithRelations<typeof dbSchema>
>

/**
 * Data service for scene settings operations.
 * Focuses purely on data access and manipulation.
 */
class SceneSettingsService {
	private readonly db = getDbClient()

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
	 * Creates or updates scene settings with versioning.
	 * @param params - Scene settings creation parameters
	 * @returns Created or updated scene settings
	 */
	async saveSceneSettings(
		params: SaveSceneSettingsParams & {
			optimizationReport?: OptimizationReport
		}
	) {
		const {
			sceneId,
			projectId,
			userId,
			settings,
			gltfJson,
			optimizationReport
		} = params

		return await this.db.transaction(async (tx) => {
			// Ensure scene exists
			const scene = await this.ensureSceneExists(tx, {
				sceneId,
				projectId,
				userId,
				sceneName: settings.meta?.sceneName
			})

			// Get current latest version
			const latestSettings = (await this.getLatestSceneSettingsInternal(
				tx,
				sceneId
			)) as typeof sceneSettings.$inferSelect

			// Check if settings have changed
			if (latestSettings) {
				const existingAssetIds = await this.getSceneAssetIds(
					tx,
					latestSettings.id
				)

				const noChanges = await this.hasNoChanges(
					settings,
					latestSettings,
					gltfJson,
					existingAssetIds,
					tx
				)

				if (noChanges) {
					return { ...latestSettings, unchanged: true }
				}

				// Determine if only settings changed (assets haven't changed)
				const settingsChanged = this.compareSceneSettings(
					settings,
					latestSettings
				)
				
				let assetsChanged = false
				if (this.isGLTFExportResult(gltfJson)) {
					const extractedAssets = this.extractGLTFAssets(gltfJson)
					if (extractedAssets.length > 0) {
						const currentAssetHashes = this.computeAssetHashes(extractedAssets)
						const existingAssetHashes = await this.getAssetHashes(
							existingAssetIds,
							tx
						)
						assetsChanged = this.compareAssetHashes(
							currentAssetHashes,
							existingAssetHashes
						)
					}
				}

				// Create new version with conditional asset processing
				return await this.createNewSettingsVersion(tx, {
					projectId,
					sceneId: scene.id,
					userId,
					settings,
					gltfJson,
					previousVersion: latestSettings?.version || 0,
					optimizationReport,
					existingAssetIds: assetsChanged ? [] : existingAssetIds
				})
			}

			// Create new version with processed GLTF JSON
			return await this.createNewSettingsVersion(tx, {
				projectId,
				sceneId: scene.id,
				userId,
				settings,
				gltfJson,
				previousVersion: latestSettings?.version || 0,
				optimizationReport,
				existingAssetIds: []
			})
		})
	}

	/**
	 * Type guard to check if gltfJson is a GLTFExportResult
	 */
	private isGLTFExportResult(
		gltfJson: JSONDocument | GLTFExportResult
	): gltfJson is GLTFExportResult {
		return (
			typeof gltfJson === 'object' &&
			gltfJson !== null &&
			'format' in gltfJson &&
			gltfJson.format === 'gltf'
		)
	}

	/**
	 * Retrieves the latest scene settings for a scene.
	 * Downloads assets from cloud storage and returns them with scene settings.
	 * @param sceneId - The scene ID
	 * @returns Latest scene settings with associated assets and asset data
	 */
	async getLatestSceneSettings(sceneId: string) {
		const settings = await this.db
			.select()
			.from(sceneSettings)
			.where(
				and(
					eq(sceneSettings.sceneId, sceneId),
					eq(sceneSettings.isLatest, true)
				)
			)
			.limit(1)

		if (settings.length === 0) return null

		// Get associated asset records
		const sceneAssetsData = await this.db
			.select({ asset: assets })
			.from(sceneAssets)
			.innerJoin(assets, eq(sceneAssets.assetId, assets.id))
			.where(eq(sceneAssets.sceneSettingsId, settings[0].id))

		// Extract asset IDs
		const assetIds = sceneAssetsData.map((sa) => sa.asset.id)

		// Download asset data from cloud storage
		let gltfJson: ExtendedGLTFDocument | null = null
		let assetDataMap:
			| Map<string, { data: Uint8Array; mimeType: string; fileName: string }>
			| undefined

		if (assetIds.length > 0) {
			try {
				assetDataMap = await assetStorageService.downloadAssets(assetIds)

				// Find and parse the GLTF JSON asset
				const gltfAsset = sceneAssetsData.find(
					(sa) => sa.asset.mimeType === 'model/gltf+json'
				)

				if (gltfAsset && assetDataMap.has(gltfAsset.asset.id)) {
					const gltfAssetData = assetDataMap.get(gltfAsset.asset.id)
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
			...settings[0],
			assets: sceneAssetsData.map((sa) => sa.asset),
			assetData: assetDataMap, // Map of assetId -> asset data for reconstruction
			gltfJson // The parsed GLTF JSON document
		}
	}

	/**
	 * Retrieves all versions of scene settings for a scene.
	 * @param sceneId - The scene ID
	 * @returns All scene settings versions ordered by version descending
	 */
	async getSceneSettingsVersions(sceneId: string) {
		return await this.db
			.select()
			.from(sceneSettings)
			.where(eq(sceneSettings.sceneId, sceneId))
			.orderBy(desc(sceneSettings.version))
	}

	/**
	 * Creates a new version of existing scene settings.
	 * @param params - Update parameters
	 * @returns New version of scene settings
	 */
	async createNewVersion(params: UpdateSceneSettingsParams) {
		const { sceneSettingsId, userId, settings, gltfJson } = params

		return await this.db.transaction(async (tx) => {
			// Get current settings
			const currentSettings = await tx
				.select()
				.from(sceneSettings)
				.where(eq(sceneSettings.id, sceneSettingsId))
				.limit(1)

			if (currentSettings.length === 0) {
				throw new Error('Scene settings not found')
			}

			// Get scene to retrieve projectId
			const scene = await tx
				.select()
				.from(scenes)
				.where(eq(scenes.id, currentSettings[0].sceneId))
				.limit(1)

			if (scene.length === 0) {
				throw new Error('Scene not found')
			}

			// Mark current as not latest
			await tx
				.update(sceneSettings)
				.set({ isLatest: false })
				.where(eq(sceneSettings.sceneId, currentSettings[0].sceneId))

			// Create new version (processGLTFExport is called within createNewSettingsVersion)
			return await this.createNewSettingsVersion(tx, {
				projectId: scene[0].projectId,
				sceneId: currentSettings[0].sceneId,
				userId,
				settings,
				gltfJson,
				previousVersion: currentSettings[0].version
			})
		})
	}

	/**
	 * Updates existing scene settings in place (same version).
	 * @param params - Update parameters
	 * @returns Updated scene settings
	 */
	async updateSceneSettings(
		params: Omit<UpdateSceneSettingsParams, 'userId' | 'createNewVersion'>
	) {
		const { sceneSettingsId, settings, gltfJson } = params

		return await this.db.transaction(async (tx) => {
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
				.set({
					environment: settings.environment,
					controls: settings.controls,
					shadows: settings.shadows,
					meta: settings.meta
				})
				.where(eq(sceneSettings.id, sceneSettingsId))
				.returning()

			// Update assets if GLTF was processed
			if (processedGltf !== undefined) {
				await this.updateSceneAssets(tx, sceneSettingsId, processedGltf)
			}

			return updatedSettings
		})
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
	 * @param options - Query options (version, label, limit)
	 * @returns Scene stats records
	 */
	async getSceneStats(
		sceneId: string,
		options?: { version?: number; label?: string; limit?: number }
	) {
		const conditions = [eq(sceneStats.sceneId, sceneId)]

		if (options?.version !== undefined) {
			conditions.push(eq(sceneStats.version, options.version))
		}

		if (options?.label) {
			conditions.push(eq(sceneStats.label, options.label))
		}

		const query = this.db
			.select()
			.from(sceneStats)
			.where(and(...conditions))
			.orderBy(desc(sceneStats.version))
			.$dynamic()

		if (options?.limit) {
			return await query.limit(options.limit)
		}

		return await query
	}

	/**
	 * Retrieves the latest scene stats for a scene.
	 * @param sceneId - The scene ID
	 * @returns Latest scene stats or null
	 */
	async getLatestSceneStats(sceneId: string) {
		const stats = await this.db
			.select()
			.from(sceneStats)
			.where(eq(sceneStats.sceneId, sceneId))
			.orderBy(desc(sceneStats.version))
			.limit(1)

		return stats.length > 0 ? stats[0] : null
	}

	// Private helper methods

	/**
	 * Gets latest scene settings within a transaction.
	 */
	private async getLatestSceneSettingsInternal(
		tx: DbTransaction,
		sceneId: string
	) {
		const settings = await tx
			.select()
			.from(sceneSettings)
			.where(
				and(
					eq(sceneSettings.sceneId, sceneId),
					eq(sceneSettings.isLatest, true)
				)
			)
			.limit(1)

		return settings[0] || null
	}

	/**
	 * Gets asset IDs for scene settings.
	 */
	private async getSceneAssetIds(
		tx: DbTransaction,
		sceneSettingsId: string
	): Promise<string[]> {
		const assets = await tx
			.select({ assetId: sceneAssets.assetId })
			.from(sceneAssets)
			.where(eq(sceneAssets.sceneSettingsId, sceneSettingsId))

		return assets.map((a) => a.assetId)
	}

	/**
	 * Checks if settings or assets have changed.
	 */
	private async hasNoChanges(
		currentSettings: SceneSettingsData,
		existingSettings: typeof sceneSettings.$inferSelect,
		gltfJson: JSONDocument | GLTFExportResult,
		existingAssetIds: string[],
		tx: DbTransaction
	): Promise<boolean> {
		// Check if settings have changed
		const settingsChanged = this.compareSceneSettings(
			currentSettings,
			existingSettings
		)

		// If settings changed, we need to create a new version regardless of assets
		// But we can still skip asset re-upload if assets haven't changed
		
		// Extract asset info from the GLTF JSON
		let assetsChanged = false

		if (this.isGLTFExportResult(gltfJson)) {
			// For GLTFExportResult, compare asset content hashes
			const extractedAssets = this.extractGLTFAssets(gltfJson)
			
			if (extractedAssets.length > 0) {
				// Compute hashes for current assets
				const currentAssetHashes = this.computeAssetHashes(extractedAssets)
				
				// Get existing asset hashes from database
				const existingAssetHashes = await this.getAssetHashes(
					existingAssetIds,
					tx
				)
				
				// Compare asset hashes
				assetsChanged = this.compareAssetHashes(
					currentAssetHashes,
					existingAssetHashes
				)
			}
		} else {
			// For extended GLTF document, extract embedded asset IDs and compare
			const currentAssetIds = this.extractAssetIdsFromGltf(
				gltfJson as ExtendedGLTFDocument
			)
			assetsChanged = this.compareAssetIds(currentAssetIds, existingAssetIds)
		}

		return !settingsChanged && !assetsChanged
	}

	/**
	 * Compares two scene settings objects for changes.
	 */
	private compareSceneSettings(
		current: SceneSettingsData,
		existing: typeof sceneSettings.$inferSelect
	): boolean {
		return (
			JSON.stringify(current.environment) !==
				JSON.stringify(existing.environment) ||
			JSON.stringify(current.controls) !== JSON.stringify(existing.controls) ||
			JSON.stringify(current.shadows) !== JSON.stringify(existing.shadows) ||
			JSON.stringify(current.meta) !== JSON.stringify(existing.meta)
		)
	}

	/**
	 * Compares two asset ID arrays for changes.
	 */
	private compareAssetIds(
		currentIds: string[],
		existingIds: string[]
	): boolean {
		if (currentIds.length !== existingIds.length) return true

		const sortedCurrent = [...currentIds].sort()
		const sortedExisting = [...existingIds].sort()

		return sortedCurrent.some((id, index) => id !== sortedExisting[index])
	}

	/**
	 * Computes content hashes for a list of assets.
	 */
	private computeAssetHashes(
		assets: GLTFAssetData[]
	): Map<string, string> {
		const hashes = new Map<string, string>()
		
		for (const asset of assets) {
			const hash = assetStorageService.computeAssetHash(asset.data)
			hashes.set(asset.fileName, hash)
		}
		
		return hashes
	}

	/**
	 * Retrieves asset hashes from database for existing assets.
	 */
	private async getAssetHashes(
		assetIds: string[],
		tx: DbTransaction
	): Promise<Map<string, string>> {
		const hashes = new Map<string, string>()
		
		if (assetIds.length === 0) return hashes
		
		// Fetch asset metadata from database
		const assetRecords = await tx
			.select()
			.from(assets)
			.where(
				assetIds.length > 0
					? eq(assets.id, assetIds[0])
					: eq(assets.id, '')
			)
		
		// If we have multiple asset IDs, we need to query them differently
		// For now, query them one by one (can be optimized with an IN clause)
		for (const assetId of assetIds) {
			const [asset] = await tx
				.select()
				.from(assets)
				.where(eq(assets.id, assetId))
				.limit(1)
			
			if (asset) {
				const metadata = asset.metadata as { contentHash?: string } | null
				if (metadata?.contentHash) {
					hashes.set(asset.name, metadata.contentHash)
				}
			}
		}
		
		return hashes
	}

	/**
	 * Compares two sets of asset hashes to determine if assets have changed.
	 */
	private compareAssetHashes(
		currentHashes: Map<string, string>,
		existingHashes: Map<string, string>
	): boolean {
		// Different number of assets means something changed
		if (currentHashes.size !== existingHashes.size) return true
		
		// Check if any hash differs
		for (const [fileName, currentHash] of currentHashes) {
			const existingHash = existingHashes.get(fileName)
			if (!existingHash || existingHash !== currentHash) {
				return true
			}
		}
		
		return false
	}

	/**
	 * Ensures scene exists, creates if necessary.
	 */
	private async ensureSceneExists(
		tx: DbTransaction,
		params: {
			sceneId: string
			projectId: string
			userId: string
			sceneName?: string
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
				name: params.sceneName || 'Untitled Scene',
				description: 'Scene created from publisher',
				projectId: params.projectId,
				folderId: userFolder[0]?.id,
				status: 'draft'
			})
			.returning()

		return newScene
	}

	/**
	 * Creates a new version of scene settings.
	 */
	private async createNewSettingsVersion(
		tx: DbTransaction,
		params: CreateSceneSettingsParams & {
			optimizationReport?: OptimizationReport
			existingAssetIds?: string[]
		}
	) {
		const {
			sceneId,
			userId,
			settings,
			gltfJson,
			previousVersion,
			projectId,
			optimizationReport,
			existingAssetIds = []
		} = params

		// Process GLTF export if provided - extract and upload assets
		let assetIds: string[] = []
		if (gltfJson) {
			// If existingAssetIds are provided, it means assets haven't changed
			// So we can skip the upload and reuse existing asset IDs
			if (existingAssetIds.length > 0) {
				assetIds = existingAssetIds
			} else {
				// Assets have changed or this is a new scene, process them
				const processedGltf = await this.processGLTFExport(
					sceneId,
					userId,
					projectId,
					gltfJson
				)
				assetIds = processedGltf.assetIds
			}
		}

		// Mark current latest as not latest
		await tx
			.update(sceneSettings)
			.set({ isLatest: false })
			.where(eq(sceneSettings.sceneId, sceneId))

		// Create new scene settings version
		const [newSettings] = await tx
			.insert(sceneSettings)
			.values({
				sceneId,
				version: previousVersion + 1,
				isLatest: true,
				environment: settings.environment,
				controls: settings.controls,
				shadows: settings.shadows,
				meta: settings.meta,
				createdBy: userId
			})
			.returning()

		// Link assets to scene settings
		if (assetIds.length > 0) {
			await tx.insert(sceneAssets).values(
				assetIds.map((assetId) => ({
					sceneSettingsId: newSettings.id,
					assetId,
					usageType: 'gltf-asset'
				}))
			)
		}

		// Create scene stats if optimization report is available
		if (optimizationReport) {
			const statsData = createSceneStatsFromReport(
				optimizationReport,
				sceneId,
				userId,
				{
					version: previousVersion + 1,
					label:
						previousVersion === 0
							? 'initial'
							: `version-${previousVersion + 1}`,
					description: `Scene statistics for version ${previousVersion + 1}`
				}
			)

			await tx.insert(sceneStats).values(statsData)
		}

		return newSettings
	}

	/**
	 * Extract asset data from GLTFExportResult (with separate assets)
	 */
	private extractGLTFAssets(
		gltfExportResult: GLTFExportResult
	): GLTFAssetData[] {
		const extractedAssets: GLTFAssetData[] = []

		if (
			!this.isGLTFExportResult(gltfExportResult) ||
			!gltfExportResult.assets
		) {
			console.warn('No assets found in GLTF export result')
			return extractedAssets
		}

		// Handle Map format (from ModelExporter directly)
		if (gltfExportResult.assets instanceof Map) {
			gltfExportResult.assets.forEach((data: Uint8Array, fileName: string) => {
				const extension = fileName.split('.').pop()?.toLowerCase()
				let mimeType: string
				let type: 'buffer' | 'image'

				// Determine MIME type and asset type based on file extension
				if (extension === 'bin') {
					mimeType = 'application/octet-stream'
					type = 'buffer'
				} else if (extension === 'png') {
					mimeType = 'image/png'
					type = 'image'
				} else if (extension === 'jpg' || extension === 'jpeg') {
					mimeType = 'image/jpeg'
					type = 'image'
				} else if (extension === 'webp') {
					mimeType = 'image/webp'
					type = 'image'
				} else {
					mimeType = 'application/octet-stream'
					type = 'buffer'
				}

				extractedAssets.push({
					fileName,
					data,
					mimeType,
					type
				})
			})
		}
		// Handle serialized array format (from JSON transfer)
		else if (Array.isArray(gltfExportResult.assets)) {
			gltfExportResult.assets.forEach((asset: SerializedAsset) => {
				const fileName = asset.fileName
				const extension = fileName.split('.').pop()?.toLowerCase()
				let mimeType: string
				let type: 'buffer' | 'image'

				if (extension === 'bin') {
					mimeType = 'application/octet-stream'
					type = 'buffer'
				} else if (extension === 'png') {
					mimeType = 'image/png'
					type = 'image'
				} else if (extension === 'jpg' || extension === 'jpeg') {
					mimeType = 'image/jpeg'
					type = 'image'
				} else if (extension === 'webp') {
					mimeType = 'image/webp'
					type = 'image'
				} else {
					mimeType = 'application/octet-stream'
					type = 'buffer'
				}

				// Convert number array back to Uint8Array
				const data = new Uint8Array(asset.data)

				extractedAssets.push({
					fileName,
					data,
					mimeType,
					type
				})
			})
		}

		return extractedAssets
	}

	/**
	 * Upload GLTF assets to cloud storage and return asset IDs
	 */
	private async uploadGLTFAssets(
		sceneId: string,
		userId: string,
		projectId: string,
		gltfExportResult: GLTFExportResult
	): Promise<string[]> {
		const gltfAssets = this.extractGLTFAssets(gltfExportResult)

		if (gltfAssets.length === 0) {
			return []
		}

		const uploadResults = await assetStorageService.uploadSceneAssets(
			sceneId,
			userId,
			projectId,
			gltfAssets
		)

		return uploadResults.map((result) => result.assetId)
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
		if (this.isGLTFExportResult(gltfJson)) {
			// Extract and upload assets
			const assetIds = await this.uploadGLTFAssets(
				sceneId,
				userId,
				projectId,
				gltfJson
			)

			// Upload the GLTF JSON itself as an asset
			const gltfJsonData = JSON.stringify(gltfJson.data)
			const gltfJsonAsset: GLTFAssetData = {
				fileName: 'scene.gltf',
				data: new TextEncoder().encode(gltfJsonData),
				mimeType: 'model/gltf+json',
				type: 'buffer'
			}

			const [gltfJsonUploadResult] =
				await assetStorageService.uploadSceneAssets(
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
			const extendedGltfDoc: ExtendedGLTFDocument = {
				...baseDoc,
				assetIds: allAssetIds,
				asset: {
					...baseDoc.asset,
					extensions: {
						...baseDoc.asset?.extensions,
						VECTREAL_asset_metadata: {
							assetIds: allAssetIds
						}
					}
				}
			}

			return { assetIds: allAssetIds, gltfDocument: extendedGltfDoc }
		} else {
			// Already a plain JSONDocument - check if it has embedded asset IDs
			const existingAssetIds = this.extractAssetIdsFromGltf(
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
	private extractAssetIdsFromGltf(gltfJson: ExtendedGLTFDocument): string[] {
		const assetIds: string[] = []

		// Check if gltfJson has metadata with asset IDs
		if (gltfJson.asset?.extensions) {
			const extensions = gltfJson.asset.extensions
			if (extensions.VECTREAL_asset_metadata?.assetIds) {
				assetIds.push(...extensions.VECTREAL_asset_metadata.assetIds)
			}
		}

		// Alternative: Extract from custom metadata if stored elsewhere
		if (gltfJson.assetIds && Array.isArray(gltfJson.assetIds)) {
			assetIds.push(...gltfJson.assetIds)
		}

		return assetIds
	}

	/**
	 * Updates assets associated with scene settings.
	 * Processes GLTF export result, uploads assets, and creates database links.
	 */
	private async updateSceneAssets(
		tx: DbTransaction,
		sceneSettingsId: string,
		gltfJson: JSONDocument | GLTFExportResult | ExtendedGLTFDocument
	) {
		// Remove existing asset links
		await tx
			.delete(sceneAssets)
			.where(eq(sceneAssets.sceneSettingsId, sceneSettingsId))

		// Add new asset links if asset IDs exist in the GLTF JSON
		if (gltfJson) {
			let assetIds: string[] = []

			// Extract asset IDs based on the type of GLTF data
			if (this.isGLTFExportResult(gltfJson)) {
				// This shouldn't happen in updateSceneAssets as it should be processed first
				console.warn(
					'Received GLTFExportResult in updateSceneAssets - should be processed first'
				)
			} else {
				assetIds = this.extractAssetIdsFromGltf(
					gltfJson as ExtendedGLTFDocument
				)
			}

			if (assetIds.length > 0) {
				await tx.insert(sceneAssets).values(
					assetIds.map((assetId) => ({
						sceneSettingsId,
						assetId,
						usageType: 'gltf-asset'
					}))
				)
			}
		}
	}

	/**
	 * Ensures user has a default scene folder.
	 */
	private async ensureSceneFolderExists(
		projectId: string,
		userId: string,
		tx: DbTransaction
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
