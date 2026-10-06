import { Box3, type Object3D } from 'three'

import { computeModelFingerprint } from './shadow-bake'

/** What one walk of a model's geometry yields, kept for the model's lifetime. */
export interface ModelMeasurement {
	/** The model's bounds in its parent's space: its own transform, no ancestor's. */
	bounds: Box3
	/** Total vertex count, the bake signature's geometric fingerprint. */
	vertexCount: number
}

const measurements = new WeakMap<Object3D, ModelMeasurement>()

/**
 * Walks `model` once and remembers the result for as long as the object lives.
 *
 * Every consumer used to walk it again: the scale, the centering key, the
 * shadows, the AO radius and the clipping planes each ran their own
 * `Box3.setFromObject`. The box is the rest pose; hotspot occlusion walks the
 * live pose itself, because an animation moves it. The bounds are taken without the ancestors,
 * so the normalization scale applied above the model, which changes without
 * replacing it, never goes stale here; `worldBounds` applies it on each read.
 */
export const measureModel = (model: Object3D): ModelMeasurement => {
	const known = measurements.get(model)
	if (known) return known

	const measurement = {
		bounds: measureInParentSpace(model),
		vertexCount: computeModelFingerprint(model)
	}
	measurements.set(model, measurement)
	return measurement
}

/**
 * Detached for the walk, so whatever holds the model at first measure, a host
 * scene's rotated group included, contributes nothing to the cached box.
 */
const measureInParentSpace = (model: Object3D): Box3 => {
	const parent = model.parent
	model.parent = null
	try {
		model.updateWorldMatrix(false, true)
		return new Box3().setFromObject(model)
	} finally {
		model.parent = parent
		model.updateWorldMatrix(true, true)
	}
}

/**
 * The model's current world-space bounds, from its one measurement and its
 * ancestors' transforms as they stand now.
 *
 * Exact for the viewer's tree, where every ancestor of a model only translates
 * it or scales it uniformly (`Center`, then the normalization group): the
 * transformed box is the box `setFromObject` would have measured.
 */
export const worldBounds = (model: Object3D, target = new Box3()): Box3 => {
	target.copy(measureModel(model).bounds)
	if (model.parent) {
		model.parent.updateWorldMatrix(true, false)
		target.applyMatrix4(model.parent.matrixWorld)
	}
	return target
}
