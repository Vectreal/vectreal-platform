import {
	ControlsProps,
	EnvironmentProps,
	ShadowsProps,
	ToneMappingProps
} from '@vctrl/viewer'
import { and, desc, eq } from 'drizzle-orm'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'

import { getDbClient } from '../../db/client'
import {
	assets,
	organizations,
	permissions,
	projects,
	sceneAssets,
	sceneFolders,
	scenes,
	sceneSettings
} from '../../db/schema'

import * as dbSchema from '../../db/schema'

/**
 * Scene settings data structure for API operations.
 */
export interface SceneSettingsData {
	readonly environment?: EnvironmentProps
	readonly toneMapping?: ToneMappingProps
	readonly controls?: ControlsProps
	readonly shadows?: ShadowsProps
	readonly meta?: {
		readonly sceneName?: string
		readonly thumbnailUrl?: string
		readonly isSaved?: boolean
	}
}

/**
 * Parameters for creating new scene settings.
 */
export interface CreateSceneSettingsParams {
	readonly sceneId: string
	readonly projectId: string
	readonly userId: string
	readonly settingsData: SceneSettingsData
	readonly assetIds?: readonly string[]
}

/**
 * Parameters for updating existing scene settings.
 */
export interface UpdateSceneSettingsParams {
	readonly sceneSettingsId: string
	readonly userId: string
	readonly settingsData: SceneSettingsData
	readonly assetIds?: readonly string[]
	readonly createNewVersion?: boolean
}

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
	async saveSceneSettings(params: CreateSceneSettingsParams) {
		const { sceneId, projectId, userId, settingsData, assetIds = [] } = params

		return await this.db.transaction(async (tx) => {
			// Ensure scene exists
			const scene = await this.ensureSceneExists(tx, {
				sceneId,
				projectId,
				userId,
				sceneName: settingsData.meta?.sceneName
			})

			// Get current latest version
			const latestSettings = await this.getLatestSceneSettingsInternal(
				tx,
				sceneId
			)

			// Check if settings have changed
			if (latestSettings) {
				const existingAssetIds = await this.getSceneAssetIds(
					tx,
					latestSettings.id
				)

				if (
					this.hasNoChanges(
						settingsData,
						latestSettings,
						assetIds,
						existingAssetIds
					)
				) {
					return { ...latestSettings, unchanged: true }
				}
			}

			// Create new version
			return await this.createNewSettingsVersion(tx, {
				sceneId: scene.id,
				userId,
				settingsData,
				assetIds,
				previousVersion: latestSettings?.version || 0
			})
		})
	}

	/**
	 * Retrieves the latest scene settings for a scene.
	 * @param sceneId - The scene ID
	 * @returns Latest scene settings with associated assets
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

		// Get associated assets
		const sceneAssetsData = await this.db
			.select({ asset: assets })
			.from(sceneAssets)
			.innerJoin(assets, eq(sceneAssets.assetId, assets.id))
			.where(eq(sceneAssets.sceneSettingsId, settings[0].id))

		return {
			...settings[0],
			assets: sceneAssetsData.map((sa) => sa.asset)
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
		const { sceneSettingsId, userId, settingsData, assetIds = [] } = params

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

			// Mark current as not latest
			await tx
				.update(sceneSettings)
				.set({ isLatest: false })
				.where(eq(sceneSettings.sceneId, currentSettings[0].sceneId))

			// Create new version
			return await this.createNewSettingsVersion(tx, {
				sceneId: currentSettings[0].sceneId,
				userId,
				settingsData,
				assetIds,
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
		const { sceneSettingsId, settingsData, assetIds } = params

		return await this.db.transaction(async (tx) => {
			// Update settings
			const [updatedSettings] = await tx
				.update(sceneSettings)
				.set({
					environment: settingsData.environment,
					toneMapping: settingsData.toneMapping,
					controls: settingsData.controls,
					shadows: settingsData.shadows,
					meta: settingsData.meta
				})
				.where(eq(sceneSettings.id, sceneSettingsId))
				.returning()

			// Update assets if provided
			if (assetIds !== undefined) {
				await this.updateSceneAssets(tx, sceneSettingsId, assetIds)
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
	private hasNoChanges(
		currentSettings: SceneSettingsData,
		existingSettings: {
			environment: unknown
			toneMapping: unknown
			controls: unknown
			shadows: unknown
			meta: unknown
		},
		currentAssetIds: readonly string[],
		existingAssetIds: string[]
	): boolean {
		const settingsChanged = this.compareSceneSettings(
			currentSettings,
			existingSettings
		)
		const assetsChanged = this.compareAssetIds(
			[...currentAssetIds],
			existingAssetIds
		)

		return !settingsChanged && !assetsChanged
	}

	/**
	 * Compares two scene settings objects for changes.
	 */
	private compareSceneSettings(
		current: SceneSettingsData,
		existing: {
			environment: unknown
			toneMapping: unknown
			controls: unknown
			shadows: unknown
			meta: unknown
		}
	): boolean {
		return (
			JSON.stringify(current.environment) !==
				JSON.stringify(existing.environment) ||
			JSON.stringify(current.toneMapping) !==
				JSON.stringify(existing.toneMapping) ||
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
		params: {
			sceneId: string
			userId: string
			settingsData: SceneSettingsData
			assetIds: readonly string[]
			previousVersion: number
		}
	) {
		const { sceneId, userId, settingsData, assetIds, previousVersion } = params

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
				environment: settingsData.environment,
				toneMapping: settingsData.toneMapping,
				controls: settingsData.controls,
				shadows: settingsData.shadows,
				meta: settingsData.meta,
				createdBy: userId
			})
			.returning()

		// Link assets to scene settings
		if (assetIds.length > 0) {
			await tx.insert(sceneAssets).values(
				assetIds.map((assetId) => ({
					sceneSettingsId: newSettings.id,
					assetId
				}))
			)
		}

		return newSettings
	}

	/**
	 * Updates assets associated with scene settings.
	 */
	private async updateSceneAssets(
		tx: DbTransaction,
		sceneSettingsId: string,
		assetIds: readonly string[]
	) {
		// Remove existing assets
		await tx
			.delete(sceneAssets)
			.where(eq(sceneAssets.sceneSettingsId, sceneSettingsId))

		// Add new assets
		if (assetIds.length > 0) {
			await tx.insert(sceneAssets).values(
				assetIds.map((assetId) => ({
					sceneSettingsId,
					assetId
				}))
			)
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
