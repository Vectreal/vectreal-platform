import type { CameraProps, CameraTransitionConfig } from '@vctrl/core'

/**
 * A signature only this module can mint.
 *
 * Branded on purpose. The comparison it feeds is only sound while both sides
 * are built the same way, and the bug it replaced was exactly a hand-rolled
 * `JSON.stringify` of the *resolved* pose - which reads as an ordinary string
 * and assigns without complaint. With the brand, writing one by hand is a type
 * error at the call site rather than a snap the author sees months later.
 */
export type CameraSelectionSignature = string & {
	readonly __cameraSelectionSignature: unique symbol
}

/**
 * What the author stored for a camera, as a comparable string.
 *
 * The selection effect uses this to tell two different questions apart: a
 * *different* camera was chosen, which should fly, versus the *same* camera's
 * properties were edited, which should apply instantly so a sidebar nudge does
 * not re-trigger a transition.
 *
 * It has to be built from the stored camera and nothing else. The resolved
 * selection is not a safe input, because a camera that does not fully specify
 * its own pose is completed from the live one: a missing position is derived
 * through an orbit radius measured off the scene camera, and a missing fov is
 * simply the scene camera's. Signing the resolved values therefore made the
 * signature change while nothing was edited - every frame of a flight moves the
 * camera it was measured from - so a mid-flight re-render read "same camera,
 * new properties" and snapped the camera to the end of a transition it was
 * still playing.
 *
 * That was unreachable for as long as every camera an author could reach
 * carried a full pose, and it stopped being unreachable when hotspot cameras
 * started carrying a target and no position.
 *
 * Absent fields are signed as null rather than skipped, so adding a position to
 * a camera that had none still reads as an edit.
 */
export function cameraSelectionSignature(
	cameras: CameraProps['cameras'],
	cameraId: string,
	transition: CameraTransitionConfig | undefined
): CameraSelectionSignature {
	const camera = cameras?.find((entry) => entry.cameraId === cameraId)

	return JSON.stringify({
		position: triple(camera?.position),
		target: triple(camera?.target ?? camera?.lookAt),
		rotation: triple(camera?.rotation),
		fov: typeof camera?.fov === 'number' ? camera.fov : null,
		transition: transition ?? null
	}) as CameraSelectionSignature
}

/**
 * A stored vector, or null for anything that is not one.
 *
 * Stored settings arrive from persisted JSON and from a host application, so a
 * partial or non-numeric vector is expressible; signing one raw would make the
 * signature depend on how it happened to serialize.
 */
function triple(value: unknown): [number, number, number] | null {
	if (!Array.isArray(value) || value.length !== 3) return null
	if (!value.every((axis) => Number.isFinite(axis))) return null
	return [value[0], value[1], value[2]]
}
