/**
 * Pure helpers for the per-scene size gate (storage_bytes_per_scene).
 * Isomorphic: no server or DB imports, so it is unit-testable and reusable by
 * both the request parser and the server-side save operation.
 */

/** Coerce a FormData string (or any value) to a non-negative finite number, else undefined. */
export function parseSceneBytes(value: unknown): number | undefined {
	if (typeof value === 'number') {
		return Number.isFinite(value) && value >= 0 ? value : undefined
	}
	if (typeof value === 'string') {
		const trimmed = value.trim()
		if (trimmed === '') return undefined
		const parsed = Number(trimmed)
		return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
	}
	return undefined
}

/** True only when the scene size is known and strictly exceeds a numeric limit (null = unlimited). */
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

interface SceneCurrentBytesSources {
	/** Measured by a pass in this session. Absent until one runs. */
	optimizedSceneBytes?: number | null
	/** What the last save wrote to `scene_stats.current_scene_bytes`. */
	persistedCurrentSceneBytes?: number | null
	/**
	 * Size of the stored glTF + assets package. This is the *working* scene, not
	 * the delivered artifact — with Draco enabled the published GLB is far
	 * smaller — so it is only a starting point, never a correction.
	 */
	clientSceneBytes?: number | null
}

/**
 * The scene's current delivered size, as sent to the server on save and used
 * for the plan size gate.
 *
 * The persisted value has to sit between the two runtime figures. Reopening a
 * saved scene hydrates `optimizedSceneBytes` to null and `clientSceneBytes` to
 * the uncompressed package size, so without the middle term a settings-only
 * save would send that larger number and overwrite a smaller, accurate one that
 * an earlier optimization pass had already persisted.
 *
 * Mirrors the precedence `resolveSceneMetrics` uses for display
 * (`runtimeCurrent ?? persistedCurrent ?? …`), so the number shown and the
 * number saved cannot diverge.
 */
export function resolveSceneCurrentBytes({
	optimizedSceneBytes,
	persistedCurrentSceneBytes,
	clientSceneBytes
}: SceneCurrentBytesSources): number | undefined {
	for (const candidate of [
		optimizedSceneBytes,
		persistedCurrentSceneBytes,
		clientSceneBytes
	]) {
		if (
			typeof candidate === 'number' &&
			Number.isFinite(candidate) &&
			candidate >= 0
		) {
			return candidate
		}
	}

	return undefined
}
