/**
 * The scene camera model and its math, without a renderer.
 *
 * Which camera a scene opens on, what a stored camera resolves to, how the view
 * flies between two cameras and where orbit limits hold it. The viewer applies
 * these to its live camera; anything without a canvas (a capture, a server-side
 * thumbnail, a CLI) asks the same questions and gets the same answers.
 *
 * Published at `@vctrl/core/scene-camera` as well as the package root, so a
 * consumer that only needs the camera math loads `three` and nothing else.
 */
export {
	DEFAULT_CAMERA,
	isSceneCamera,
	normalizeCameraSettings
} from './camera-settings'
export {
	cameraSelectionSignature,
	type CameraSelectionSignature
} from './camera-selection-signature'
export { withOpeningPose, type OpeningPose } from './opening-pose'
export { resolveHotspotCameraTargets } from './resolve-hotspot-camera-targets'
export {
	resolveCameraPose,
	type LiveCameraState,
	type ResolvedCameraPose
} from './camera-pose'
export {
	easeFlightProgress,
	sampleCameraFlight,
	SMART_FLIGHT_CLEARANCE,
	type CameraFlight,
	type CameraFlightFrame,
	type CameraFlightPose
} from './camera-flight'
export { clampToOrbitLimits, type OrbitLimits } from './orbit-limits'
