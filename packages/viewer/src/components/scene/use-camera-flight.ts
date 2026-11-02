import { useFrame, useThree } from '@react-three/fiber'
import {
	easeFlightProgress,
	sampleCameraFlight
} from '@vctrl/core/scene-camera'
import { useCallback, useMemo, useRef, type RefObject } from 'react'
import {
	type Object3D,
	type PerspectiveCamera,
	Quaternion,
	Sphere,
	Vector3
} from 'three'

import { worldBounds } from './model-measurement'

import type { CameraTransitionEasing } from '@vctrl/core'
import type {
	CameraFlight,
	CameraFlightFrame,
	CameraFlightPose
} from '@vctrl/core/scene-camera'

type CameraFlightRuntime = {
	flight: CameraFlight
	startAtMs: number
	durationMs: number
	/** Reused every frame, so a flight allocates once. */
	frame: CameraFlightFrame
	/** The eased progress of the pose last written to the camera. */
	shown: number
}

export interface CameraFlightRunner {
	/**
	 * Flies the live camera from where it is to `to`, replacing any flight in
	 * progress.
	 */
	start: (
		to: CameraFlightPose,
		type: CameraFlight['type'],
		durationMs: number,
		easing?: CameraTransitionEasing
	) => void
	/** Drops the flight in progress, leaving the camera where it is. */
	stop: () => void
	/**
	 * The eased progress of the pose the camera holds, or null without a
	 * flight. The pose of the last frame drawn, not the clock's: a paused
	 * frameloop (a hidden pane) leaves the camera mid-flight while time runs on.
	 */
	progress: () => number | null
	/**
	 * The ends of the flight in progress, for refitting them in place when the
	 * viewport changes shape; null without one.
	 */
	ends: () => { from: CameraFlightPose; to: CameraFlightPose } | null
}

const now = () =>
	typeof performance !== 'undefined' ? performance.now() : Date.now()

/**
 * Plays camera flights on the live camera: samples `sampleCameraFlight` at
 * the raw progress of every frame and writes the pose to the camera and the
 * orbit controls.
 *
 * `modelRef` is read when a flight starts, for Smart's clearance, so a model
 * swap does not change the runner's identity. `onLand` runs on the frame a
 * flight arrives, read when it does for the same reason.
 */
export function useCameraFlight(
	modelRef: RefObject<Object3D | null | undefined>,
	onLand?: () => void
): CameraFlightRunner {
	const { camera: sceneCamera } = useThree()
	const invalidate = useThree((state) => state.invalidate)
	const controls = useThree((state) => state.controls) as
		| {
				target?: Vector3
				update?: () => void
		  }
		| undefined
	const runtimeRef = useRef<CameraFlightRuntime | null>(null)
	const onLandRef = useRef(onLand)
	onLandRef.current = onLand

	const start = useCallback<CameraFlightRunner['start']>(
		(to, type, durationMs, easing) => {
			const activeCamera = sceneCamera as PerspectiveCamera
			runtimeRef.current = {
				flight: {
					type,
					from: {
						position: activeCamera.position.clone(),
						target: controls?.target?.clone() ?? new Vector3(0, 0, 0),
						fov: activeCamera.fov
					},
					to: {
						position: to.position.clone(),
						target: to.target.clone(),
						fov: to.fov
					},
					easing,
					bounds: modelRef.current
						? worldBounds(modelRef.current).getBoundingSphere(new Sphere())
						: null
				},
				startAtMs: now(),
				durationMs,
				frame: {
					position: new Vector3(),
					target: new Vector3(),
					fov: activeCamera.fov,
					quaternion: new Quaternion()
				},
				shown: 0
			}
			invalidate()
		},
		[controls?.target, invalidate, modelRef, sceneCamera]
	)

	const stop = useCallback(() => {
		runtimeRef.current = null
	}, [])

	const progress = useCallback(() => {
		return runtimeRef.current?.shown ?? null
	}, [])

	const ends = useCallback(() => {
		const runtime = runtimeRef.current
		return runtime ? { from: runtime.flight.from, to: runtime.flight.to } : null
	}, [])

	useFrame(() => {
		const runtime = runtimeRef.current
		if (!runtime) return

		const activeCamera = sceneCamera as PerspectiveCamera
		const rawProgress = Math.min(
			1,
			Math.max(0, (now() - runtime.startAtMs) / runtime.durationMs)
		)
		const frame = sampleCameraFlight(
			runtime.flight,
			rawProgress,
			runtime.frame,
			activeCamera.up
		)

		activeCamera.position.copy(frame.position)
		activeCamera.quaternion.copy(frame.quaternion)
		activeCamera.fov = frame.fov
		activeCamera.updateProjectionMatrix()
		runtime.shown = easeFlightProgress(rawProgress, runtime.flight.easing)

		// The target the frame was aimed at, so update()'s lookAt agrees.
		if (controls?.target) {
			controls.target.copy(frame.target)
			controls.update?.()
		}

		if (rawProgress >= 1) {
			runtimeRef.current = null
			onLandRef.current?.()
		}

		invalidate()
	})

	return useMemo(
		() => ({ start, stop, progress, ends }),
		[start, stop, progress, ends]
	)
}
