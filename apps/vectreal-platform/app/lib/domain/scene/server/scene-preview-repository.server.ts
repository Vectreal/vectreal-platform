import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../../../db/client'
import { assets } from '../../../../db/schema/project/assets'
import { scenePublished } from '../../../../db/schema/project/scene-published'
import { scenes } from '../../../../db/schema/project/scenes'
import {
	extensionsUsedFromMetadata,
	type PublishedModelRow
} from '../embed-asset-policy'

const db = getDbClient()

/**
 * The publication of a scene, joined to its GLB's asset row. Null unless the
 * scene is published. `projectId`, when given, must match: a caller holding a
 * key for one project gets nothing from another.
 */
async function selectPublishedScene(sceneId: string, projectId?: string) {
	const rows = await db
		.select({
			sceneId: scenes.id,
			projectId: scenes.projectId,
			status: scenes.status,
			publishedAssetId: scenePublished.assetId,
			publishedAt: scenePublished.publishedAt,
			publishedAssetSizeBytes: assets.fileSize,
			publishedAssetName: assets.name,
			publishedAssetMimeType: assets.mimeType,
			publishedAssetFilePath: assets.filePath,
			publishedAssetMetadata: assets.metadata
		})
		.from(scenes)
		.innerJoin(scenePublished, eq(scenePublished.sceneId, scenes.id))
		.leftJoin(assets, eq(assets.id, scenePublished.assetId))
		.where(
			projectId === undefined
				? eq(scenes.id, sceneId)
				: and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId))
		)
		.limit(1)

	if (rows.length === 0) {
		return null
	}

	if (rows[0].status !== 'published') {
		return null
	}

	return rows[0]
}

export function getPublishedScenePreview(projectId: string, sceneId: string) {
	return selectPublishedScene(sceneId, projectId)
}

/**
 * The same publication, for a caller that proved the scene by other means: a
 * signed asset URL names the scene but carries no project.
 */
export function getPublishedSceneById(sceneId: string) {
	return selectPublishedScene(sceneId)
}

export type PublishedScenePreview = NonNullable<
	Awaited<ReturnType<typeof getPublishedScenePreview>>
>

/** Adapts the query row to the shape `embed-asset-policy` reasons about. */
export function toPublishedModelRow(
	preview: PublishedScenePreview
): PublishedModelRow {
	return {
		assetId: preview.publishedAssetId,
		fileName: preview.publishedAssetName,
		mimeType: preview.publishedAssetMimeType,
		byteSize: preview.publishedAssetSizeBytes,
		extensionsUsed: extensionsUsedFromMetadata(preview.publishedAssetMetadata)
	}
}
