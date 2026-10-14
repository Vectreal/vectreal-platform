/**
 * Whether a scene size is over the plan's per-scene limit
 * (storage_bytes_per_scene): only when both are known and the size is strictly
 * over it, so a null (unlimited) limit never is. The publisher warns with it;
 * the server applies the same rule at publish, to the GLB it stored.
 */
export function isSceneOverSizeLimit(
	sceneBytes: number | undefined,
	limit: number | null
): boolean {
	return (
		typeof sceneBytes === 'number' &&
		typeof limit === 'number' &&
		sceneBytes > limit
	)
}
