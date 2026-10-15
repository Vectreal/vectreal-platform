import { and, eq, notInArray, sql } from 'drizzle-orm'

import { getDbClient } from '../../../../db/client'
import * as dbSchema from '../../../../db/schema'
import {
	assets,
	sceneAssets,
	sceneHotspots,
	sceneSettings
} from '../../../../db/schema'
import {
	SceneSettingsUpsertInput,
	SceneSettingsWithAssets
} from '../../../../types/api'
import { SCENE_ASSET_ROLE } from '../scene-asset-roles'
import { columnBackedSceneSettings } from '../scene-settings-comparison'

import type {
	HotspotDefinition,
	ScenePresentationSettings,
	SceneSettings
} from '@vctrl/core'
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
		animation: row.animation ?? undefined,
		bounds: row.bounds ?? undefined,
		camera: row.camera ?? undefined,
		controls: row.controls ?? undefined,
		environment: row.environment ?? undefined,
		interactions: row.interactions ?? undefined,
		normalization: row.normalization ?? undefined,
		presentation: row.presentation ?? undefined,
		shadows: row.shadows ?? undefined,
		hotspots: hotspots.length > 0 ? hotspots : undefined
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

/**
 * Merges `patch` into a scene's stored presentation, leaving every field it
 * does not name as it was. Null when the scene has no settings row.
 *
 * One statement, so a concurrent writer cannot interleave between a read and
 * a write here. `updated_at` moves with it, because the manifest's ETag is
 * keyed on it: a toggle that left it alone would be revalidated away as a 304.
 */
export async function updateScenePresentation(
	sceneId: string,
	patch: ScenePresentationSettings
): Promise<ScenePresentationSettings | null> {
	const [row] = await getDbClient()
		.update(sceneSettings)
		.set({
			presentation: sql`(coalesce(${sceneSettings.presentation}::jsonb, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb)::json`,
			updatedAt: sql`now()`
		})
		.where(eq(sceneSettings.sceneId, sceneId))
		.returning({ presentation: sceneSettings.presentation })

	return row ? (row.presentation ?? {}) : null
}

export async function getSceneSettingsWithAssetsRow(
	tx: SceneSettingsTransaction,
	sceneId: string
): Promise<SceneSettingsWithAssets | null> {
	const settings = await getSceneSettingsBySceneId(tx, sceneId)
	if (!settings) return null

	const sceneAssetsData = await tx
		.select({ asset: assets, usageType: sceneAssets.usageType })
		.from(sceneAssets)
		.innerJoin(assets, eq(sceneAssets.assetId, assets.id))
		.where(eq(sceneAssets.sceneSettingsId, settings.id))

	// The one place links are read, so the kept original is told apart here
	// and no reader downstream can take it for part of the model.
	return {
		settings,
		assets: sceneAssetsData
			.filter((sa) => sa.usageType !== SCENE_ASSET_ROLE.source)
			.map((sa) => sa.asset),
		sourceAsset:
			sceneAssetsData.find((sa) => sa.usageType === SCENE_ASSET_ROLE.source)
				?.asset ?? null
	}
}

function buildSceneSettingsValues(params: SceneSettingsUpsertInput) {
	return {
		sceneId: params.sceneId,
		createdBy: params.createdBy,
		...columnBackedSceneSettings(params.settings)
	}
}

/** What a scene links: every asset, and which of them is its kept original. */
export async function getSceneAssetLinks(
	tx: SceneSettingsTransaction,
	sceneSettingsId: string
): Promise<{ assetIds: string[]; sourceAssetId: string | null }> {
	const links = await tx
		.select({ assetId: sceneAssets.assetId, usageType: sceneAssets.usageType })
		.from(sceneAssets)
		.where(eq(sceneAssets.sceneSettingsId, sceneSettingsId))

	return {
		assetIds: links.map((link) => link.assetId),
		sourceAssetId:
			links.find((link) => link.usageType === SCENE_ASSET_ROLE.source)
				?.assetId ?? null
	}
}

/**
 * Whether `assetId` is linked to `sceneId` via the `scene_assets` join table.
 *
 * Assets are de-duplicated per project by content hash (see
 * `uploadSceneAssets`), so the same asset row can legitimately be shared by
 * multiple scenes - the asset's `metadata.sceneId` only records the scene
 * that happened to create the row first and must not be used for
 * authorization.
 */
export async function isAssetLinkedToScene(
	assetId: string,
	sceneId: string
): Promise<boolean> {
	const [row] = await getDbClient()
		.select({ assetId: sceneAssets.assetId })
		.from(sceneAssets)
		.innerJoin(sceneSettings, eq(sceneAssets.sceneSettingsId, sceneSettings.id))
		.where(
			and(eq(sceneAssets.assetId, assetId), eq(sceneSettings.sceneId, sceneId))
		)
		.limit(1)

	return Boolean(row)
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
	assetIds: string[],
	sourceAssetId: string | null = null
) {
	const links = [
		...assetIds.map((assetId) => ({
			sceneSettingsId,
			assetId,
			usageType: SCENE_ASSET_ROLE.model
		})),
		...(sourceAssetId
			? [
					{
						sceneSettingsId,
						assetId: sourceAssetId,
						usageType: SCENE_ASSET_ROLE.source
					}
				]
			: [])
	]
	if (links.length === 0) return

	await tx.insert(sceneAssets).values(links)
}

export async function replaceSceneAssets(
	tx: SceneSettingsTransaction,
	sceneSettingsId: string,
	assetIds: string[],
	sourceAssetId: string | null = null
) {
	await tx
		.delete(sceneAssets)
		.where(eq(sceneAssets.sceneSettingsId, sceneSettingsId))

	await linkSceneAssets(tx, sceneSettingsId, assetIds, sourceAssetId)
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
		// `id` only breaks the tie between hotspots authored in the same write,
		// so a list can never reshuffle itself between two reads.
		.orderBy(
			sceneHotspots.sequenceIndex,
			sceneHotspots.createdAt,
			sceneHotspots.id
		)

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		// `||`, not `??`: a row written before the parser normalized an empty
		// string can hold '', and reading that back as '' would report the scene
		// dirty against a client that sends `undefined` for the same emptiness.
		body: r.body || undefined,
		linkUrl: r.linkUrl || undefined,
		worldPosition: [r.worldPositionX, r.worldPositionY, r.worldPositionZ] as [
			number,
			number,
			number
		],
		linkedCameraId: r.linkedCameraId ?? undefined,
		visible: r.visible,
		internalOnly: r.internalOnly,
		sequenceIndex: r.sequenceIndex ?? undefined,
		stylePreset: r.stylePreset,
		payloadUrl: r.payloadUrl ?? undefined,
		occlusionEnabled: r.occlusionEnabled
	}))
}

export async function replaceHotspots(
	tx: SceneSettingsTransaction,
	sceneSettingsId: string,
	hotspots: HotspotDefinition[]
): Promise<void> {
	const scopedToScene = eq(sceneHotspots.sceneSettingsId, sceneSettingsId)
	const survivingIds = hotspots.map((h) => h.id)

	// Rows that survive the save are updated in place rather than deleted and
	// reinserted, so `createdAt` keeps recording when the hotspot was authored,
	// which is what unsequenced hotspots are ordered by. notInArray rejects an
	// empty list, and a save that keeps nothing is a full clear anyway.
	await tx
		.delete(sceneHotspots)
		.where(
			survivingIds.length === 0
				? scopedToScene
				: and(scopedToScene, notInArray(sceneHotspots.id, survivingIds))
		)

	if (hotspots.length === 0) return

	const written = await tx
		.insert(sceneHotspots)
		.values(
			hotspots.map((h) => ({
				id: h.id,
				sceneSettingsId,
				name: h.name,
				body: h.body ?? null,
				linkUrl: h.linkUrl ?? null,
				worldPositionX: h.worldPosition[0],
				worldPositionY: h.worldPosition[1],
				worldPositionZ: h.worldPosition[2],
				linkedCameraId: h.linkedCameraId ?? null,
				visible: h.visible,
				internalOnly: h.internalOnly,
				sequenceIndex: h.sequenceIndex ?? null,
				stylePreset: h.stylePreset,
				payloadUrl: h.payloadUrl ?? null,
				occlusionEnabled: h.occlusionEnabled ?? true
			}))
		)
		.onConflictDoUpdate({
			target: sceneHotspots.id,
			// `id` is the global primary key, so a conflict can land on a row the
			// scene-scoped delete never saw because it belongs to another scene.
			// Postgres evaluates setWhere under the same row lock as the conflict
			// resolution, which a pre-check select could not; a row it blocks is
			// left untouched and omitted from `returning`.
			setWhere: scopedToScene,
			set: {
				name: sql`excluded.name`,
				body: sql`excluded.body`,
				linkUrl: sql`excluded.link_url`,
				worldPositionX: sql`excluded.world_position_x`,
				worldPositionY: sql`excluded.world_position_y`,
				worldPositionZ: sql`excluded.world_position_z`,
				linkedCameraId: sql`excluded.linked_camera_id`,
				visible: sql`excluded.visible`,
				internalOnly: sql`excluded.internal_only`,
				sequenceIndex: sql`excluded.sequence_index`,
				stylePreset: sql`excluded.style_preset`,
				payloadUrl: sql`excluded.payload_url`,
				occlusionEnabled: sql`excluded.occlusion_enabled`,
				updatedAt: new Date()
			}
		})
		.returning({ id: sceneHotspots.id })

	if (written.length !== hotspots.length) {
		const writtenIds = new Set(written.map((row) => row.id))
		const collidedIds = survivingIds.filter((id) => !writtenIds.has(id))

		throw new Error(
			`Hotspot id(s) already belong to a different scene: ${collidedIds.join(', ')}`
		)
	}
}
