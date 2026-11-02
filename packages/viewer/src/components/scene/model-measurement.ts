import { Box3, type Material, type Mesh, type Object3D } from 'three'

import { computeModelFingerprint } from './shadow-bake'

/** What one walk of a model's geometry yields, kept for the model's lifetime. */
export interface ModelMeasurement {
	/** The model's bounds in its parent's space: its own transform, no ancestor's. */
	bounds: Box3
	/** Total vertex count, the bake signature's geometric fingerprint. */
	vertexCount: number
	/** Meshes, each one draw in every pass that draws the model. */
	meshCount: number
	/** Whether any material transmits light, which adds a transmission pass. */
	transmissive: boolean
}

const measurements = new WeakMap<Object3D, ModelMeasurement>()

/**
 * Walks `model` once and remembers the result for as long as the object lives.
 *
 * Every consumer used to walk it again: the scale, the centering key, the
 * shadows, the AO radius and the clipping planes each ran their own
 * `Box3.setFromObject`. The box is the rest pose; hotspot occlusion walks the
 * live pose itself, because an animation moves it. The bounds are taken without
 * the ancestors, so the normalization scale applied above the model, which
 * changes without replacing it, never goes stale here; `worldBounds` applies it
 * on each read. An empty model is not remembered: it may be filled later.
 */
export const measureModel = (model: Object3D): ModelMeasurement => {
	const known = measurements.get(model)
	if (known) return known

	const measurement = {
		bounds: measureInParentSpace(model),
		vertexCount: computeModelFingerprint(model),
		...countDraws(model)
	}
	if (!measurement.bounds.isEmpty()) measurements.set(model, measurement)
	return measurement
}

const countDraws = (model: Object3D) => {
	let meshCount = 0
	let transmissive = false
	model.traverse((object) => {
		const mesh = object as Mesh
		if (!mesh.isMesh) return
		meshCount += 1
		const materials: Material[] = Array.isArray(mesh.material)
			? mesh.material
			: [mesh.material]
		transmissive ||= materials.some(
			(material) =>
				((material as { transmission?: number }).transmission ?? 0) > 0
		)
	})
	return { meshCount, transmissive }
}

/**
 * Detached for the walk, so whatever holds the model at first measure, a host
 * scene's rotated group included, contributes nothing to the cached box.
 * `updateMatrixWorld`, not `updateWorldMatrix`: only the former refreshes a
 * skinned mesh's bind inverse, which its bounds are computed against.
 */
const measureInParentSpace = (model: Object3D): Box3 => {
	const parent = model.parent
	model.parent = null
	try {
		model.updateMatrixWorld(true)
		return new Box3().setFromObject(model)
	} finally {
		model.parent = parent
		parent?.updateWorldMatrix(true, false)
		model.updateMatrixWorld(true)
	}
}

/**
 * The model's current world-space bounds, from its one measurement and its
 * ancestors' transforms as they stand now.
 *
 * Exact for the viewer's tree, where every ancestor of a model only translates
 * it or scales it uniformly (`Center`, then the normalization group): the
 * transformed box is the box `setFromObject` would have measured. A descendant
 * with `matrixWorldAutoUpdate` off keeps the world matrix it was given, so it is
 * measured where that matrix puts it.
 */
export const worldBounds = (model: Object3D, target = new Box3()): Box3 => {
	target.copy(measureModel(model).bounds)
	if (model.parent) {
		model.parent.updateWorldMatrix(true, false)
		target.applyMatrix4(model.parent.matrixWorld)
	}
	return target
}
