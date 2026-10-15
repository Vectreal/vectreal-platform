/**
 * A scene's size for the dashboard: the published GLB once there is one, which
 * only a publish records; before that, everything the scene stores apart from
 * its kept original, thumbnail and shadow bake included, which the publisher's
 * figure (the model package alone) leaves out; and the original upload only
 * when nothing else is known.
 */
export function resolveSceneSizeBytes(
	stats: {
		currentSceneBytes?: null | number
		initialSceneBytes?: null | number
	} | null,
	modelAssets: readonly { fileSize?: null | number }[]
): null | number {
	if (typeof stats?.currentSceneBytes === 'number') {
		return stats.currentSceneBytes
	}
	if (modelAssets.length > 0) {
		return modelAssets.reduce(
			(total, asset) => total + (asset.fileSize ?? 0),
			0
		)
	}
	return stats?.initialSceneBytes ?? null
}
