import { Vector3 } from 'three'

import type { BoundsApi } from '@react-three/drei'
import type { Object3D, PerspectiveCamera } from 'three'

export type InitialFramingControls = {
	target: Vector3
	update?: () => void
}

/**
 * Frames a newly loaded model for its first view, or leaves a saved camera
 * where the scene stored it.
 *
 * The fit is drei's own (`getSize()` honours the surface's `margin`), but it is
 * applied here rather than through `bounds.reset()`. That call only records a
 * goal for a later frame, so everything that reads the camera after
 * initialization saw the default pose instead of the fit: the stability check
 * that reports `initial_framing_completed`, and the publisher's automatic
 * opening view, which writes the pose it reads into the default camera where
 * SceneCamera re-applies it over the fit.
 *
 * The fit measures `model`, not the whole `<Bounds>` group. Everything else
 * mounted there would count too: with shadows on at load, the shadow plane is
 * 2.5 times the model's footprint and the model opened at about a quarter of
 * the frame. Without a model (a viewer showing only `children`) the group is
 * all there is to frame.
 *
 * The fit keeps the side the camera approaches from. With `fromLevel` (a
 * camera with no pose of its own) it never approaches from below: the default
 * camera stands level with the origin, and the model sits on it, so its plain
 * approach looks up at the model. Controls that stop at level clamped that
 * view up on their first update anyway; now every host opens on it.
 */
export function applyInitialFraming(
	bounds: BoundsApi,
	model: Object3D | null | undefined,
	camera: PerspectiveCamera,
	controls: InitialFramingControls | null | undefined,
	fitToBounds: boolean,
	fromLevel = false
) {
	// Also clears any goal drei is still animating toward, such as SceneModel's
	// normalization refit, so nothing moves the camera after this returns.
	bounds.refresh(model ?? undefined)

	if (!fitToBounds) {
		bounds.clip()
		return
	}

	const { center, distance } = bounds.getSize()
	const direction = camera.position.clone().sub(center)
	if (fromLevel) levelFromBelow(direction, camera.up)
	direction.normalize()
	camera.position.copy(center).addScaledVector(direction, distance)
	// Aim without relying on the controls, which may not be registered yet.
	camera.lookAt(center)

	if (controls) {
		controls.target.copy(center)
		// Last, so the controls' own polar clamp and aim are what the camera keeps.
		controls.update?.()
	}

	// After every write, so a reader before the next render sees the final pose.
	camera.updateMatrixWorld()
}

/**
 * Drops the part of `direction` that points below level, measured along `up`.
 * A direction straight below becomes a level one: the camera's front, or its
 * side when `up` is its front.
 */
function levelFromBelow(direction: Vector3, cameraUp: Vector3) {
	// three.js accepts an `up` of any length; the projection needs a unit one.
	const up = cameraUp.clone().normalize()
	const along = direction.dot(up)
	if (along >= 0) return
	direction.addScaledVector(up, -along)
	if (direction.lengthSq() > 1e-12) return
	for (const axis of [new Vector3(0, 0, 1), new Vector3(1, 0, 0)]) {
		direction.copy(axis).addScaledVector(up, -axis.dot(up))
		if (direction.lengthSq() > 1e-12) return
	}
}
