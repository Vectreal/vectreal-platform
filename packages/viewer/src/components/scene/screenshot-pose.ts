import {
	clampToOrbitLimits,
	resolveCameraPose,
	scaleOrbitDistanceLimits
} from '@vctrl/core/scene-camera'

import type { SceneCameraSnapshot } from '../../types/viewer-types'
import type { CameraConfig, CameraProps } from '@vctrl/core'
import type {
	LiveCameraState,
	OpeningPose,
	OrbitDistanceLimits,
	OrbitLimits
} from '@vctrl/core/scene-camera'
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
 * The live controls' limits, with the host's distance limits scaled by the fit
 * of the pose a capture renders.
 *
 * The live controls carry distance limits scaled with the fit of the view on
 * screen (`CameraFraming.distanceLimits`). A capture renders a pose fitted to
 * its own output, so it is held to the host's limits scaled the same way, as
 * the viewer holds that pose on a viewport of the output's shape; the live
 * ones could push it out, or let it through, by the fit of a different view.
 */
export function captureOrbitLimits(
	controls: OrbitLimits,
	limits: OrbitDistanceLimits,
	scale: number
): OrbitLimits {
	return {
		minPolarAngle: controls.minPolarAngle,
		maxPolarAngle: controls.maxPolarAngle,
		minAzimuthAngle: controls.minAzimuthAngle,
		maxAzimuthAngle: controls.maxAzimuthAngle,
		...scaleOrbitDistanceLimits(limits, scale)
	}
}

/** The id the view on screen stands under when a capture resolves it. */
const VIEW_CAPTURE_CAMERA_ID = 'viewport-capture'

/**
 * The view on screen as a stored camera (`SceneCameraSnapshot`, which records
 * it without the fit on screen), so a capture of it resolves through the same
 * rule as a capture of any stored camera.
 */
export function viewCaptureCamera(view: SceneCameraSnapshot): CameraConfig {
	return {
		cameraId: VIEW_CAPTURE_CAMERA_ID,
		name: 'Viewport',
		position: view.position,
		rotation: view.rotation,
		target: view.target,
		fov: view.fov,
		framingAspect: view.framingAspect
	}
}

/**
 * Where a capture of `cameraId` renders from, for an image `outputAspect`
 * wide over its height.
 *
 * Resolved by the viewer's camera rule (`resolveCameraPose`) at the output's
 * aspect, so the image shows what the viewer shows on a viewport of that shape:
 * a thumbnail and the scene it loads into frame the subject alike. Rendering
 * the stored pose at the canvas's aspect and cropping it to the output instead
 * made the subject larger by however far the canvas's shape was from the
 * output's, either way.
 *
 * With `controls`, the pose aims at its target and is held to their angles and
 * the host's distance limits, scaled by its fit as the live rig scales them;
 * without, it keeps its rotation.
 */
export function resolveCapturePose(
	cameras: CameraProps['cameras'],
	cameraId: string,
	live: Omit<LiveCameraState, 'viewportAspect'>,
	outputAspect: number,
	openingPose: OpeningPose | null,
	controls: OrbitLimits | null,
	distanceLimits: OrbitDistanceLimits
): CapturePose {
	const resolved = resolveCameraPose(
		cameras,
		cameraId,
		{ ...live, viewportAspect: outputAspect },
		openingPose
	)

	return controls
		? {
				position: resolved.position,
				fov: resolved.fov,
				lookAt: resolved.target,
				limits: captureOrbitLimits(
					controls,
					distanceLimits,
					resolved.framing?.scale ?? 1
				)
			}
		: {
				position: resolved.position,
				fov: resolved.fov,
				rotation: resolved.rotation
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
 * keeps the live camera's zoom, view offset and clip planes, and takes the
 * output's `aspect`; the caller renders it into a region of that shape and
 * fits the clip planes to the new pose.
 */
export function buildCaptureCamera(
	live: PerspectiveCamera,
	pose: CapturePose,
	aspect: number
): PerspectiveCamera {
	const capture = live.clone()
	capture.aspect = aspect
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

/** A region of the canvas, in drawing-buffer pixels from its top left. */
export interface CaptureRegion {
	x: number
	y: number
	width: number
	height: number
}

/**
 * The largest region of a `width` by `height` canvas shaped like the output,
 * centered: where a capture renders, and what the image is read from.
 *
 * In whole pixels. The renderer rounds the viewport it is given, and a
 * fractional region would then be read a sliver outside what was drawn.
 */
export function centeredCaptureRegion(
	width: number,
	height: number,
	outputAspect: number
): CaptureRegion {
	if (width / height > outputAspect) {
		const regionWidth = Math.round(height * outputAspect)
		return {
			x: Math.floor((width - regionWidth) / 2),
			y: 0,
			width: regionWidth,
			height
		}
	}
	const regionHeight = Math.round(width / outputAspect)
	return {
		x: 0,
		y: Math.floor((height - regionHeight) / 2),
		width,
		height: regionHeight
	}
}
