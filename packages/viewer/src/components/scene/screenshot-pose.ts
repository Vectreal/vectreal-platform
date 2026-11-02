import {
	clampToOrbitLimits,
	scaleOrbitDistanceLimits
} from '@vctrl/core/scene-camera'

import type { OrbitDistanceLimits, OrbitLimits } from '@vctrl/core/scene-camera'
import type { Euler, PerspectiveCamera, Vector3 } from 'three'

/**
 * Where a screenshot looks from. `lookAt` aims the camera at a point, as orbit
 * controls do every frame, and `limits` holds it to the controls' range;
 * without `lookAt` the camera keeps `rotation`.
 */
export type CapturePose = {
	position: Vector3
	fov: number
} & ({ lookAt: Vector3; limits?: OrbitLimits } | { rotation: Euler })

/**
 * The live controls' limits with the host's distance limits as it set them.
 *
 * The live controls carry distance limits scaled with the viewport fit of the
 * view on screen (`CameraFraming.distanceLimits`). A capture renders a stored
 * pose without that fit, so it is held to the limits the pose was stored
 * within; the scaled ones could push it out, or let it through, by the fit of
 * a different camera.
 */
export function unfittedOrbitLimits(
	controls: OrbitLimits,
	limits: OrbitDistanceLimits
): OrbitLimits {
	return {
		minPolarAngle: controls.minPolarAngle,
		maxPolarAngle: controls.maxPolarAngle,
		minAzimuthAngle: controls.minAzimuthAngle,
		maxAzimuthAngle: controls.maxAzimuthAngle,
		...scaleOrbitDistanceLimits(limits, 1)
	}
}

/**
 * A camera of the capture's own, posed for one screenshot.
 *
 * The live camera has owners: a running camera transition writes position,
 * rotation, fov and the controls target on every frame, and orbit controls
 * write it on every update. A capture that posed the live camera had to fight
 * them for the frames it waits, and had to put back afterwards a pose it read
 * at its start. When a transition ended during those frames, that pose was a
 * sample from mid-flight and nothing moved the camera off it again.
 *
 * Rendering through a clone leaves the live camera to its owners. The clone
 * keeps the live camera's aspect, zoom, view offset and clip planes; the
 * caller fits the clip planes to the new pose.
 */
export function buildCaptureCamera(
	live: PerspectiveCamera,
	pose: CapturePose
): PerspectiveCamera {
	const capture = live.clone()
	if ('lookAt' in pose) {
		capture.position.copy(
			pose.limits
				? clampToOrbitLimits(
						pose.position,
						pose.lookAt,
						capture.up,
						pose.limits
					)
				: pose.position
		)
		capture.lookAt(pose.lookAt)
	} else {
		capture.position.copy(pose.position)
		capture.rotation.copy(pose.rotation)
	}
	capture.fov = pose.fov
	capture.updateProjectionMatrix()
	capture.updateMatrixWorld()
	return capture
}
