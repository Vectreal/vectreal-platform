import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

/**
 * Aims a hotspot's camera at its hotspot, where the author never said otherwise.
 *
 * A hotspot camera is minted with a name and a field of view and nothing else,
 * so it carries neither a position nor a target. `resolveCameraSelection` fills
 * a missing target from the live orbit target, which is the frame the visitor is
 * already looking at - so activating a hotspot left the camera where it stood,
 * still looking at the middle of the model. The one thing a hotspot camera is
 * for is looking at its hotspot, and that was the one thing it did not do.
 *
 * A default, not an override: an explicit `target` (or the legacy `lookAt`) is
 * the author framing the shot by hand and always wins. Position is deliberately
 * left alone - inventing one would be inventing a viewpoint, whereas a target
 * only decides where an existing viewpoint looks.
 *
 * Narrow on purpose: only a camera tagged `kind: 'hotspot'` is filled in. The
 * Linked Camera picker offers every camera in the scene, so a hotspot can point
 * at the opening frame or at another hotspot's camera, and re-aiming a viewpoint
 * the author composed is exactly the edit nobody asked for.
 *
 * Returns the array it was given when nothing changed, so a caller can keep
 * memoizing on its identity.
 */
export function resolveHotspotCameraTargets(
	cameras: CameraConfig[] | undefined,
	hotspots: readonly HotspotDefinition[] | undefined
): CameraConfig[] | undefined {
	if (!Array.isArray(cameras) || cameras.length === 0) return cameras
	if (!Array.isArray(hotspots) || hotspots.length === 0) return cameras

	const targets = new Map<string, [number, number, number]>()
	for (const hotspot of hotspots) {
		const cameraId = hotspot?.linkedCameraId
		if (typeof cameraId !== 'string' || cameraId.length === 0) continue
		// The first hotspot naming a camera wins, so two hotspots sharing one
		// cannot make the aim depend on array order.
		if (targets.has(cameraId)) continue
		const position = hotspot.worldPosition
		if (!Array.isArray(position) || position.length !== 3) continue
		if (!position.every((axis) => Number.isFinite(axis))) continue
		targets.set(cameraId, [position[0], position[1], position[2]])
	}

	if (targets.size === 0) return cameras

	let changed = false
	const aimed = cameras.map((camera) => {
		if (camera?.kind !== 'hotspot') return camera
		if (camera.target || camera.lookAt) return camera
		const target = targets.get(camera.cameraId)
		if (!target) return camera
		changed = true
		return { ...camera, target }
	})

	return changed ? aimed : cameras
}
