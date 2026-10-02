import { useState } from 'react'
import { Box3, Vector3 } from 'three'

import type { Object3D } from 'three'

/**
 * Names the model a viewer is showing, independently of the `Object3D` that
 * currently renders it.
 *
 * An optimization pass re-derives the same model and hands the viewer a new
 * object every time. Inferring "a new model arrived" from object identity made
 * each pass refit the camera, so the view jumped back to its opening framing. A
 * key that survives the swap is what lets the viewer tell a new model from a
 * new rendition of the same one.
 */
export type ModelKey = number | string

/** What the viewer measures once per model and keeps across renditions. */
export interface ModelFrame {
	key: ModelKey | Object3D
	/** The pre-normalization bounding-box diagonal the scale and centering derive from. */
	rawDiagonal: number
}

const measureRawDiagonal = (model: Object3D) =>
	new Box3().setFromObject(model).getSize(new Vector3()).length()

/**
 * The frame for `model`: the previous one while the key is unchanged, a fresh
 * measurement otherwise. Without a key the object itself is the key, which is
 * how every caller behaved before keys existed.
 */
export function nextModelFrame(
	previous: ModelFrame | null,
	model: Object3D | null | undefined,
	modelKey: ModelKey | undefined
): ModelFrame | null {
	if (!model) return null

	const key = modelKey ?? model
	if (previous?.key === key) return previous

	return { key, rawDiagonal: measureRawDiagonal(model) }
}

/**
 * `nextModelFrame` held across renders. Both measuring sites, the viewer's
 * centering and `SceneModel`'s scale, call this with the same key, so they
 * cannot disagree about which measurement is current.
 */
export function useModelFrame(
	model: Object3D | null | undefined,
	modelKey: ModelKey | undefined
): ModelFrame | null {
	const [frame, setFrame] = useState<ModelFrame | null>(null)
	const next = nextModelFrame(frame, model, modelKey)
	// State adjusted during render rather than a ref: a render React discards
	// takes this update with it, so the committed frame never names a key whose
	// object was not mounted. A ref kept the discarded key, and the next render
	// re-measured the mounted object under its normalization scale.
	if (next !== frame) setFrame(next)
	return next
}
