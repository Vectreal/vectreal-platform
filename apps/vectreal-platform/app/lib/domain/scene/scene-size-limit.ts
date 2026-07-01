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
