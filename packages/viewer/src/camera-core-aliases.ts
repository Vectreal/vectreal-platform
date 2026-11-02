import {
	easeFlightProgress as coreEaseFlightProgress,
	resolveHotspotCameraTargets as coreResolveHotspotCameraTargets,
	sampleCameraFlight as coreSampleCameraFlight,
	SMART_FLIGHT_CLEARANCE as CORE_SMART_FLIGHT_CLEARANCE
} from '@vctrl/core/scene-camera'

import type {
	CameraFlight as CoreCameraFlight,
	CameraFlightFrame as CoreCameraFlightFrame,
	CameraFlightPose as CoreCameraFlightPose
} from '@vctrl/core/scene-camera'

/*
  Camera math this package used to define, now owned by `@vctrl/core`'s
  scene-camera module. Kept as aliases so imports from `@vctrl/viewer` and
  `@vctrl/viewer/camera-flight` keep working; each names where to import it
  from instead.
*/

/** @deprecated Import from `@vctrl/core/scene-camera`. May be removed in `@vctrl/viewer` 4.0.0. */
export const easeFlightProgress = coreEaseFlightProgress

/** @deprecated Import from `@vctrl/core/scene-camera`. May be removed in `@vctrl/viewer` 4.0.0. */
export const sampleCameraFlight = coreSampleCameraFlight

/** @deprecated Import from `@vctrl/core/scene-camera`. May be removed in `@vctrl/viewer` 4.0.0. */
export const SMART_FLIGHT_CLEARANCE = CORE_SMART_FLIGHT_CLEARANCE

/** @deprecated Import from `@vctrl/core/scene-camera`. May be removed in `@vctrl/viewer` 4.0.0. */
export const resolveHotspotCameraTargets = coreResolveHotspotCameraTargets

/** @deprecated Import from `@vctrl/core/scene-camera`. May be removed in `@vctrl/viewer` 4.0.0. */
export type CameraFlight = CoreCameraFlight

/** @deprecated Import from `@vctrl/core/scene-camera`. May be removed in `@vctrl/viewer` 4.0.0. */
export type CameraFlightFrame = CoreCameraFlightFrame

/** @deprecated Import from `@vctrl/core/scene-camera`. May be removed in `@vctrl/viewer` 4.0.0. */
export type CameraFlightPose = CoreCameraFlightPose
