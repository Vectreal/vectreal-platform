/**
 * The one form a scene stores a 3D vector in: `[x, y, z]`.
 *
 * Cameras and hotspots are also sent as `{ x, y, z }`, the shape three.js
 * objects serialize to and the viewer has always read, so both are accepted
 * and stored as the tuple. Isomorphic, so the save parser and the settings
 * read share it.
 */

export type Vector3Tuple = [number, number, number]

/** The camera fields that hold a vector. `lookAt` is the legacy `target`. */
export const CAMERA_VECTOR_FIELDS = [
	'position',
	'target',
	'rotation',
	'lookAt'
] as const

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value)

/** `value` as `[x, y, z]`, or null when it is neither accepted form. */
export function toVector3Tuple(value: unknown): Vector3Tuple | null {
	const components = Array.isArray(value)
		? value
		: typeof value === 'object' && value !== null
			? (() => {
					const { x, y, z, ...rest } = value as Record<string, unknown>
					return Object.keys(rest).length === 0 ? [x, y, z] : null
				})()
			: null
	if (components?.length !== 3 || !components.every(isFiniteNumber)) {
		return null
	}
	return components as Vector3Tuple
}

/**
 * A camera list's vectors as tuples where they are in an accepted form. A
 * value in neither form is left as stored: a read is not where it is refused.
 */
export function withVectorTuples<Camera extends { cameras?: object[] }>(
	camera: Camera
): Camera {
	if (!camera.cameras) return camera
	return {
		...camera,
		cameras: camera.cameras.map((entry) => {
			const coerced: Record<string, unknown> = { ...entry }
			for (const field of CAMERA_VECTOR_FIELDS) {
				const tuple = toVector3Tuple(coerced[field])
				if (tuple) coerced[field] = tuple
			}
			return coerced
		})
	}
}
