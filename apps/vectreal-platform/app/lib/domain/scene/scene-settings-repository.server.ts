import { eq } from 'drizzle-orm'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'

import * as dbSchema from '../../../db/schema'
import { assets, sceneAssets, sceneSettings } from '../../../db/schema'

import type {
	SceneSettingsUpsertInput,
	SceneSettingsWithAssets
} from './scene-settings.types.server'

export type SceneSettingsTransaction = PgTransaction<
	PostgresJsQueryResultHKT,
	typeof dbSchema,
	ExtractTablesWithRelations<typeof dbSchema>
>

export async function getSceneSettingsBySceneId(
	tx: SceneSettingsTransaction,
	sceneId: string
) {
	const settings = await tx
		.select()
		.from(sceneSettings)
		.where(eq(sceneSettings.sceneId, sceneId))
		.limit(1)

	return settings[0] || null
}

export async function getSceneSettingsWithAssetsRow(
	tx: SceneSettingsTransaction,
	sceneId: string
): Promise<SceneSettingsWithAssets | null> {
	const settings = await getSceneSettingsBySceneId(tx, sceneId)
	if (!settings) return null

	const sceneAssetsData = await tx
		.select({ asset: assets })
		.from(sceneAssets)
		.innerJoin(assets, eq(sceneAssets.assetId, assets.id))
		.where(eq(sceneAssets.sceneSettingsId, settings.id))

	return {
		settings,
		assets: sceneAssetsData.map((sa) => sa.asset)
	}
}

function buildSceneSettingsValues(params: SceneSettingsUpsertInput) {
	return {
		sceneId: params.sceneId,
		createdBy: params.createdBy,
		environment: params.settings.environment,
		controls: params.settings.controls,
		shadows: params.settings.shadows,
		meta: params.settings.meta
	}
}

export async function getSceneAssetIds(
	tx: SceneSettingsTransaction,
	sceneSettingsId: string
): Promise<string[]> {
	const assets = await tx
		.select({ assetId: sceneAssets.assetId })
		.from(sceneAssets)
		.where(eq(sceneAssets.sceneSettingsId, sceneSettingsId))

	return assets.map((asset) => asset.assetId)
}

export async function upsertSceneSettings(
	tx: SceneSettingsTransaction,
	params: SceneSettingsUpsertInput
) {
	const insertValues = buildSceneSettingsValues(params)
	const { sceneId: _, ...updateValues } = insertValues

	const [newSettings] = await tx
		.insert(sceneSettings)
		.values(insertValues)
		.onConflictDoUpdate({
			target: sceneSettings.sceneId,
			set: updateValues
		})
		.returning()

	return newSettings
}

export async function linkSceneAssets(
	tx: SceneSettingsTransaction,
	sceneSettingsId: string,
	assetIds: string[]
) {
	if (assetIds.length === 0) return

	await tx.insert(sceneAssets).values(
		assetIds.map((assetId) => ({
			sceneSettingsId,
			assetId,
			usageType: 'gltf-asset'
		}))
	)
}

export async function replaceSceneAssets(
	tx: SceneSettingsTransaction,
	sceneSettingsId: string,
	assetIds: string[]
) {
	await tx
		.delete(sceneAssets)
		.where(eq(sceneAssets.sceneSettingsId, sceneSettingsId))

	await linkSceneAssets(tx, sceneSettingsId, assetIds)
}
