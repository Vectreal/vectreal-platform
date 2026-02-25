import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { scenePublished } from '../../../db/schema/project/scene-published'
import { scenes } from '../../../db/schema/project/scenes'

const db = getDbClient()

export async function getPublishedScenePreview(
	projectId: string,
	sceneId: string
) {
	const rows = await db
		.select({
			sceneId: scenes.id,
			projectId: scenes.projectId,
			status: scenes.status,
			publishedAssetId: scenePublished.assetId,
			publishedAt: scenePublished.publishedAt
		})
		.from(scenes)
		.innerJoin(scenePublished, eq(scenePublished.sceneId, scenes.id))
		.where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId)))
		.limit(1)

	if (rows.length === 0) {
		return null
	}

	if (rows[0].status !== 'published') {
		return null
	}

	return rows[0]
}
