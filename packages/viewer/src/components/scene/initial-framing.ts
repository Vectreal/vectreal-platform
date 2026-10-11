import type { BoundsApi } from '@react-three/drei'
import type { Object3D, PerspectiveCamera, Vector3 } from 'three'

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
 */
export function applyInitialFraming(
	bounds: BoundsApi,
	model: Object3D | null | undefined,
	camera: PerspectiveCamera,
	controls: InitialFramingControls | null | undefined,
	fitToBounds: boolean
) {
	// Also clears any goal drei is still animating toward, such as SceneModel's
	// normalization refit, so nothing moves the camera after this returns.
	bounds.refresh(model ?? undefined)

	if (!fitToBounds) {
		bounds.clip()
		return
	}

	const { center, distance } = bounds.getSize()
	const direction = camera.position.clone().sub(center).normalize()
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
