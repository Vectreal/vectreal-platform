import { eq } from 'drizzle-orm'

import * as dbSchema from '../../../../db/schema'
import { assets, sceneAssets, sceneHotspots, sceneSettings } from '../../../../db/schema'
import {
	SceneSettingsUpsertInput,
	SceneSettingsWithAssets
} from '../../../../types/api'

import type { HotspotDefinition, SceneSettings } from '@vctrl/core'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'

export type SceneSettingsTransaction = PgTransaction<
	PostgresJsQueryResultHKT,
	typeof dbSchema,
	ExtractTablesWithRelations<typeof dbSchema>
>

type SceneSettingsRow = typeof sceneSettings.$inferSelect

/**
 * Maps a DB row to a SceneSettings object.
 *
 * This is the single source of truth for the read direction. When a new JSON
 * column is added to the `scene_settings` table and the corresponding field is
 * added to `SceneSettings`, update this function — not every call site.
 *
 * hotspots are stored in a separate table and must be merged in by the caller.
 * DB nullable JSON columns are coerced from null → undefined.
 */
export function rowToSceneSettings(
	row: SceneSettingsRow,
	hotspots: HotspotDefinition[] = []
): SceneSettings {
	return {
		bounds: row.bounds ?? undefined,
		camera: row.camera ?? undefined,
		controls: row.controls ?? undefined,
		environment: row.environment ?? undefined,
		interactions: row.interactions ?? undefined,
		normalization: row.normalization ?? undefined,
		shadows: row.shadows ?? undefined,
		hotspots: hotspots.length > 0 ? hotspots : undefined,
	}
}

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
	// hotspots are managed separately via replaceHotspots — exclude them here.
	// All other SceneSettings fields map 1:1 to columns and flow through automatically.
	const { hotspots: _hotspots, ...columnSettings } = params.settings
	return {
		sceneId: params.sceneId,
		createdBy: params.createdBy,
		...columnSettings
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
			set: { ...updateValues, updatedAt: new Date() }
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

// ---------------------------------------------------------------------------
// Hotspot CRUD
// ---------------------------------------------------------------------------

export async function getHotspotsBySceneSettingsId(
	tx: SceneSettingsTransaction,
	sceneSettingsId: string
): Promise<HotspotDefinition[]> {
	const rows = await tx
		.select()
		.from(sceneHotspots)
		.where(eq(sceneHotspots.sceneSettingsId, sceneSettingsId))
		.orderBy(sceneHotspots.sequenceIndex, sceneHotspots.createdAt)

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		worldPosition: [r.worldPositionX, r.worldPositionY, r.worldPositionZ] as [number, number, number],
		linkedCameraId: r.linkedCameraId ?? undefined,
		visible: r.visible,
		internalOnly: r.internalOnly,
		sequenceIndex: r.sequenceIndex ?? undefined,
		stylePreset: r.stylePreset,
		payloadUrl: r.payloadUrl ?? undefined
	}))
}

export async function replaceHotspots(
	tx: SceneSettingsTransaction,
	sceneSettingsId: string,
	hotspots: HotspotDefinition[]
): Promise<void> {
	await tx
		.delete(sceneHotspots)
		.where(eq(sceneHotspots.sceneSettingsId, sceneSettingsId))

	if (hotspots.length === 0) return

	await tx.insert(sceneHotspots).values(
		hotspots.map((h) => ({
			id: h.id,
			sceneSettingsId,
			name: h.name,
			worldPositionX: h.worldPosition[0],
			worldPositionY: h.worldPosition[1],
			worldPositionZ: h.worldPosition[2],
			linkedCameraId: h.linkedCameraId ?? null,
			visible: h.visible,
			internalOnly: h.internalOnly,
			sequenceIndex: h.sequenceIndex ?? null,
			stylePreset: h.stylePreset,
			payloadUrl: h.payloadUrl ?? null
		}))
	)
}
