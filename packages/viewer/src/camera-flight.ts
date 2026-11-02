/**
 * The camera flight between two cameras, without the viewer.
 *
 * `sampleCameraFlight` is a pure function of raw progress, the same one the
 * viewer samples on every frame. A renderer that draws frames out of order, or
 * at a fixed rate of its own, calls it per frame and gets the path the live
 * viewer flies, rather than replaying a copy that drifts from it.
 *
 * A separate entry point for the reason `hotspots` is one: the package root
 * pulls in React, drei and the stylesheet. This one needs `three` and
 * `@vctrl/core/scene-camera` alone.
 *
 * @deprecated The flight is defined in `@vctrl/core/scene-camera` now; import
 * it from there. This entry point may be removed in `@vctrl/viewer` 4.0.0.
 */

export {
	easeFlightProgress,
	sampleCameraFlight,
	SMART_FLIGHT_CLEARANCE,
	type CameraFlight,
	type CameraFlightFrame,
	type CameraFlightPose
} from './camera-core-aliases'
