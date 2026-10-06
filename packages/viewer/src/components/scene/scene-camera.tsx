import { useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
	CameraProps,
	CameraTransitionConfig,
	CameraTransitionEasing,
	CameraTransitionType
} from '@vctrl/core'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
	CatmullRomCurve3,
	Euler,
	PerspectiveCamera,
	Quaternion,
	Vector3,
	Vector3Tuple
} from 'three'

import { cameraSelectionSignature } from './camera-selection-signature'
import { applyInitialFraming } from './initial-framing'
import { withOpeningPose } from './opening-pose'

import type { CameraSelectionSignature } from './camera-selection-signature'
import type { InitialFramingControls } from './initial-framing'
import type { OpeningPose } from './opening-pose'
import type {
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '../../types/viewer-interactions'
import type { SceneCameraSnapshotCapture } from '../../types/viewer-types'

/**
 * Default camera options for the VectrealViewer.
 *
 * These defaults provide sensible values for perspective camera properties:
 * - fov: Field of view in degrees (default: 50°)
 */
export const defaultCameraOptions: CameraProps = {
	activeCameraId: 'default',
	sceneTransition: {
		type: 'linear',
		duration: 1000,
		easing: 'ease_in_out'
	},
	cameras: [
		{
			cameraId: 'default',
			name: 'Default Camera',
			fov: 60,
			initial: true
		}
	]
}

interface SceneCameraProps extends CameraProps {
	boundsEnabled?: boolean
	hasContent?: boolean
	onInitialFramingComplete?: () => void
	onCameraSnapshotCaptureReady?: (
		capture: null | SceneCameraSnapshotCapture
	) => void
	onInteractionEvent?: (event: ViewerInteractionEvent) => void
	onCommandExecutorReady?: (executor: null | ViewerCommandExecutor) => void
	/** A host's `set_transition`, which wins over `sceneTransition` while set. */
	transitionOverride?: RefObject<CameraTransitionConfig | null | undefined>
}

type CameraTransitionRuntime = {
	type: CameraTransitionType
	startAtMs: number
	durationMs: number
	startPosition: Vector3
	endPosition: Vector3
	startQuaternion: Quaternion
	endQuaternion: Quaternion
	startFov: number
	endFov: number
	startTarget: Vector3
	endTarget: Vector3
	easing?: CameraTransitionEasing
	objectAvoidanceSamples?: number
	curve?: CatmullRomCurve3
}

type ResolvedCameraSelection = {
	cameraId: string
	targetPosition: Vector3
	targetRotation: Euler
	targetFov: number
	targetLookAt: Vector3
	transition: CameraTransitionConfig
}

const DEFAULT_TRANSITION_DURATION_MS = 1000
const DEFAULT_OBJECT_AVOIDANCE_CLEARANCE = 2
const DEFAULT_OBJECT_AVOIDANCE_ARC_HEIGHT = 2
const DEFAULT_OBJECT_AVOIDANCE_SAMPLES = 24
const DEFAULT_OBJECT_AVOIDANCE_TENSION = 0.5

function hasSerializableVector3(value: unknown): boolean {
	return (
		(Array.isArray(value) && value.length >= 3) ||
		value instanceof Vector3 ||
		(typeof value === 'object' &&
			value !== null &&
			'x' in value &&
			'y' in value &&
			'z' in value)
	)
}

function toVector3(value: unknown, fallback = new Vector3(0, 0, 0)): Vector3 {
	if (Array.isArray(value) && value.length >= 3) {
		const [x, y, z] = value as Vector3Tuple
		return new Vector3(Number(x) || 0, Number(y) || 0, Number(z) || 0)
	}

	if (
		typeof value === 'object' &&
		value !== null &&
		'x' in value &&
		'y' in value &&
		'z' in value
	) {
		const vectorLike = value as { x: unknown; y: unknown; z: unknown }
		return new Vector3(
			Number(vectorLike.x) || 0,
			Number(vectorLike.y) || 0,
			Number(vectorLike.z) || 0
		)
	}

	if (value instanceof Vector3) {
		return value.clone()
	}

	return fallback.clone()
}

function toEuler(value: unknown): Euler {
	if (Array.isArray(value) && value.length >= 3) {
		const [x, y, z] = value as Vector3Tuple
		return new Euler(Number(x) || 0, Number(y) || 0, Number(z) || 0)
	}

	if (
		typeof value === 'object' &&
		value !== null &&
		'x' in value &&
		'y' in value &&
		'z' in value
	) {
		const eulerLike = value as { x: unknown; y: unknown; z: unknown }
		return new Euler(
			Number(eulerLike.x) || 0,
			Number(eulerLike.y) || 0,
			Number(eulerLike.z) || 0
		)
	}

	if (value instanceof Euler) {
		return value.clone()
	}

	if (value instanceof Vector3) {
		return new Euler(value.x, value.y, value.z)
	}

	return new Euler(0, 0, 0)
}

function resolveTransition(
	sceneTransition: CameraTransitionConfig | undefined
): CameraTransitionConfig {
	if (sceneTransition?.type) {
		return sceneTransition
	}

	return {
		type: 'linear',
		duration: DEFAULT_TRANSITION_DURATION_MS,
		easing: 'ease_in_out'
	}
}

function applyEasing(t: number, easing?: CameraTransitionEasing): number {
	switch (easing) {
		case 'ease_in':
			return t * t
		case 'ease_out':
			return 1 - (1 - t) * (1 - t)
		case 'ease_in_out':
			return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
		case 'linear':
		default:
			return t
	}
}

function resolveCameraSelection(
	cameras: CameraProps['cameras'],
	activeCameraId: CameraProps['activeCameraId'],
	currentControlsTarget: Vector3,
	sceneCamera: PerspectiveCamera,
	sceneTransition?: CameraTransitionConfig,
	openingPose: OpeningPose | null = null
): ResolvedCameraSelection {
	const sceneCameras = cameras?.filter((c) => !c.kind || c.kind === 'scene')
	const defaultCamera =
		sceneCameras && sceneCameras.length > 0 ? sceneCameras[0] : cameras?.[0]

	const foundCamera =
		cameras?.find((camera) => camera.cameraId === activeCameraId) ??
		cameras?.find((camera) => camera.initial) ??
		defaultCamera ??
		cameras?.[0] ??
		defaultCameraOptions.cameras?.[0]
	const selectedCamera =
		foundCamera && withOpeningPose(foundCamera, openingPose)

	const transition = selectedCamera
		? resolveTransition(sceneTransition)
		: ({ type: 'none' } as CameraTransitionConfig)

	const rawTargetLookAt = toVector3(
		(selectedCamera as Record<string, unknown> | undefined)?.target ??
			(selectedCamera as Record<string, unknown> | undefined)?.lookAt,
		currentControlsTarget
	)
	const rawRotation = toEuler(selectedCamera?.rotation)
	const hasPosition = hasSerializableVector3(selectedCamera?.position)
	const hasTarget = hasSerializableVector3(
		(selectedCamera as Record<string, unknown> | undefined)?.target ??
			(selectedCamera as Record<string, unknown> | undefined)?.lookAt
	)
	const hasRotation = hasSerializableVector3(selectedCamera?.rotation)
	const fallbackOrbitRadius = Math.max(
		sceneCamera.position.distanceTo(currentControlsTarget),
		1
	)
	const forward = new Vector3(0, 0, -1).applyEuler(rawRotation).normalize()

	const targetPosition = hasPosition
		? toVector3(selectedCamera?.position, sceneCamera.position)
		: hasRotation
			? rawTargetLookAt
					.clone()
					.sub(forward.clone().multiplyScalar(fallbackOrbitRadius))
			: sceneCamera.position.clone()

	const targetLookAt = hasTarget
		? rawTargetLookAt
		: hasPosition && hasRotation
			? targetPosition
					.clone()
					.add(forward.clone().multiplyScalar(fallbackOrbitRadius))
			: rawTargetLookAt

	return {
		cameraId: selectedCamera?.cameraId ?? 'default',
		targetPosition: targetPosition,
		targetRotation: rawRotation,
		targetFov:
			typeof selectedCamera?.fov === 'number'
				? selectedCamera.fov
				: sceneCamera.fov,
		targetLookAt: targetLookAt,
		transition
	}
}

function buildObjectAvoidanceCurve(
	startPosition: Vector3,
	endPosition: Vector3,
	center: Vector3,
	transition: CameraTransitionConfig
): CatmullRomCurve3 {
	const clearance =
		transition.objectAvoidance?.clearance ?? DEFAULT_OBJECT_AVOIDANCE_CLEARANCE
	const arcHeight =
		transition.objectAvoidance?.arcHeight ?? DEFAULT_OBJECT_AVOIDANCE_ARC_HEIGHT
	const tension =
		transition.objectAvoidance?.tension ?? DEFAULT_OBJECT_AVOIDANCE_TENSION

	const startDirection = startPosition.clone().sub(center).normalize()
	const endDirection = endPosition.clone().sub(center).normalize()

	let normalDirection = startDirection.clone().add(endDirection)
	if (normalDirection.lengthSq() < 0.0001) {
		normalDirection = startDirection.clone().cross(new Vector3(0, 1, 0))
		if (normalDirection.lengthSq() < 0.0001) {
			normalDirection = new Vector3(1, 0, 0)
		}
	}
	normalDirection.normalize()

	const radius =
		Math.max(
			startPosition.distanceTo(center),
			endPosition.distanceTo(center),
			1
		) + clearance

	const midpoint = center
		.clone()
		.add(normalDirection.clone().multiplyScalar(radius))
		.add(new Vector3(0, arcHeight, 0))

	const controlA = startPosition.clone().lerp(midpoint, 0.5)
	const controlB = endPosition.clone().lerp(midpoint, 0.5)

	return new CatmullRomCurve3(
		[startPosition.clone(), controlA, controlB, endPosition.clone()],
		false,
		'catmullrom',
		tension
	)
}

export const SceneCamera: React.FC<SceneCameraProps> = (props) => {
	const {
		boundsEnabled = true,
		hasContent: hasModel = false,
		onInitialFramingComplete,
		onCameraSnapshotCaptureReady,
		onCommandExecutorReady,
		onInteractionEvent,
		transitionOverride
	} = props
	const { cameras, activeCameraId, sceneTransition } = {
		...defaultCameraOptions,
		...props
	}
	const MAX_STABILIZATION_FRAMES = 24
	const MAX_STABILIZATION_DURATION_MS = 500

	const { camera: sceneCamera } = useThree()
	const invalidate = useThree((state) => state.invalidate)
	const getThreeState = useThree((state) => state.get)
	const controls = useThree((state) => state.controls) as
		| {
				target?: Vector3
				update?: () => void
		  }
		| undefined
	const bounds = useBounds()

	const initializedCameraPosition = useRef(false)
	const hasInitialFramingCompleted = useRef(false)
	/*
	  The same moment as the ref above, as state, so the executor can wait for
	  it. A camera command run before framing is overwritten by the framing
	  itself; the viewer holds commands until this layer registers.
	*/
	const [isFramed, setIsFramed] = useState(false)
	const isWaitingForStableFrame = useRef(false)
	const stableFrameCount = useRef(0)
	const previousCameraPosition = useRef<Vector3 | null>(null)
	const previousCameraQuaternion = useRef<Quaternion | null>(null)
	const previousControlsTarget = useRef<Vector3 | null>(null)
	const stabilizationFrameCount = useRef(0)
	const stabilizationStartedAt = useRef<number | null>(null)
	const transitionRuntime = useRef<CameraTransitionRuntime | null>(null)
	const openingPose = useRef<OpeningPose | null>(null)
	/** The camera in view, by whichever route it got there. */
	const previousSelectionKey = useRef<string | null>(null)
	/**
	 * The selection the props last asked for. Kept apart from the camera in
	 * view because a command (a marker click, a host call) moves the view
	 * without touching the props: compared against the view, any unrelated
	 * re-render after a command read as "the props changed" and flew back.
	 */
	const requestedSelection = useRef<{
		cameraId: string
		signature: CameraSelectionSignature
	} | null>(null)

	/*
	  Read by the command executor when a command runs, not when it was created.
	  A ref keeps the executor's identity independent of the transition: a host
	  passing an inline `sceneTransition` would otherwise re-register it, and
	  re-emit `viewer_ready`, on every render.
	*/
	const sceneTransitionRef = useRef(sceneTransition)
	sceneTransitionRef.current = sceneTransition

	const captureCameraSnapshot =
		useCallback<SceneCameraSnapshotCapture>(async () => {
			const activeCamera = sceneCamera as PerspectiveCamera
			const controlsTarget = controls?.target ?? new Vector3(0, 0, 0)

			return {
				position: [
					activeCamera.position.x,
					activeCamera.position.y,
					activeCamera.position.z
				],
				rotation: [
					activeCamera.rotation.x,
					activeCamera.rotation.y,
					activeCamera.rotation.z
				],
				target: [controlsTarget.x, controlsTarget.y, controlsTarget.z],
				fov: activeCamera.fov
			}
		}, [controls?.target, sceneCamera])

	useEffect(() => {
		onCameraSnapshotCaptureReady?.(captureCameraSnapshot)

		return () => {
			onCameraSnapshotCaptureReady?.(null)
		}
	}, [captureCameraSnapshot, onCameraSnapshotCaptureReady])

	const applyCameraInstantly = useCallback(
		(selection: ResolvedCameraSelection) => {
			const activeCamera = sceneCamera as PerspectiveCamera
			activeCamera.position.copy(selection.targetPosition)
			activeCamera.rotation.copy(selection.targetRotation)
			activeCamera.fov = selection.targetFov
			activeCamera.updateProjectionMatrix()
			if (controls?.target) {
				controls.target.copy(selection.targetLookAt)
				controls.update?.()
			}
			invalidate()
		},
		[controls, invalidate, sceneCamera]
	)

	const startTransition = useCallback(
		(selection: ResolvedCameraSelection) => {
			const activeCamera = sceneCamera as PerspectiveCamera
			const normalizedType: CameraTransitionType =
				selection.transition.type ?? 'none'
			const durationMs = Math.max(
				0,
				selection.transition.duration ?? DEFAULT_TRANSITION_DURATION_MS
			)

			if (normalizedType === 'none' || durationMs === 0) {
				transitionRuntime.current = null
				applyCameraInstantly(selection)
				return
			}

			const startQuaternion = activeCamera.quaternion.clone()
			const endQuaternion = new Quaternion().setFromEuler(
				selection.targetRotation
			)

			const runtime: CameraTransitionRuntime = {
				type: normalizedType,
				startAtMs:
					typeof performance !== 'undefined' ? performance.now() : Date.now(),
				durationMs,
				startPosition: activeCamera.position.clone(),
				endPosition: selection.targetPosition.clone(),
				startQuaternion,
				endQuaternion,
				startFov: activeCamera.fov,
				endFov: selection.targetFov,
				startTarget: controls?.target?.clone() ?? new Vector3(0, 0, 0),
				endTarget: selection.targetLookAt.clone(),
				easing: selection.transition.easing,
				objectAvoidanceSamples:
					selection.transition.objectAvoidance?.samples ??
					DEFAULT_OBJECT_AVOIDANCE_SAMPLES
			}

			if (normalizedType === 'object_avoidance') {
				const controlsTarget = selection.targetLookAt
				runtime.curve = buildObjectAvoidanceCurve(
					runtime.startPosition,
					runtime.endPosition,
					controlsTarget,
					selection.transition
				)
			}

			transitionRuntime.current = runtime
			invalidate()
		},
		[applyCameraInstantly, controls?.target, invalidate, sceneCamera]
	)

	const executeViewerCommand = useCallback(
		(command: ViewerCommand) => {
			if (command.type !== 'activate_camera') {
				return
			}

			const nextSelection = resolveCameraSelection(
				cameras,
				command.cameraId,
				controls?.target ?? new Vector3(0, 0, 0),
				sceneCamera as PerspectiveCamera,
				transitionOverride?.current ?? sceneTransitionRef.current,
				openingPose.current
			)

			if (nextSelection.cameraId !== command.cameraId) {
				return
			}

			startTransition(nextSelection)
			previousSelectionKey.current = nextSelection.cameraId
			onInteractionEvent?.({
				type: 'camera_changed',
				cameraId: nextSelection.cameraId
			})
		},
		[
			cameras,
			controls?.target,
			onInteractionEvent,
			sceneCamera,
			startTransition
		]
	)

	useEffect(() => {
		if (!isFramed) return

		// Expose the smallest imperative runtime surface possible so app layers can
		// drive viewer state without reaching into camera internals.
		onCommandExecutorReady?.({ execute: executeViewerCommand })
		onInteractionEvent?.({ type: 'viewer_ready' })

		return () => {
			onCommandExecutorReady?.(null)
		}
	}, [
		executeViewerCommand,
		isFramed,
		onCommandExecutorReady,
		onInteractionEvent
	])

	const initializeCamera = useCallback(
		(sceneCamera: PerspectiveCamera) => {
			const initialControlsTarget = controls?.target ?? new Vector3(0, 0, 0)
			const selection = resolveCameraSelection(
				cameras,
				activeCameraId,
				initialControlsTarget,
				sceneCamera,
				sceneTransition
			)
			applyCameraInstantly(selection)
			// Read from the store rather than this render's `controls`: this runs
			// from a timeout, and the fit's target is lost if it lands on a closure
			// captured before OrbitControls registered.
			applyInitialFraming(
				bounds,
				sceneCamera,
				getThreeState().controls as InitialFramingControls | null,
				boundsEnabled
			)

			if (!hasInitialFramingCompleted.current) {
				isWaitingForStableFrame.current = true
				stableFrameCount.current = 0
				stabilizationFrameCount.current = 0
				stabilizationStartedAt.current =
					typeof performance !== 'undefined' ? performance.now() : Date.now()
				previousCameraPosition.current = null
				previousCameraQuaternion.current = null
				previousControlsTarget.current = null
			}

			initializedCameraPosition.current = true
			previousSelectionKey.current = selection.cameraId
			requestedSelection.current = {
				cameraId: selection.cameraId,
				signature: cameraSelectionSignature(cameras, selection.cameraId)
			}
		},
		[
			activeCameraId,
			applyCameraInstantly,
			bounds,
			boundsEnabled,
			cameras,
			controls?.target,
			getThreeState,
			sceneTransition
		]
	)

	useEffect(() => {
		if (!hasModel) {
			initializedCameraPosition.current = false
			hasInitialFramingCompleted.current = false
			openingPose.current = null
			isWaitingForStableFrame.current = false
			setIsFramed(false)
			return
		}
		if (initializedCameraPosition.current) return
		setTimeout(() => initializeCamera(sceneCamera as PerspectiveCamera), 0)
	}, [hasModel, initializeCamera])

	useEffect(() => {
		// update camera properties if props change after initialization
		if (!initializedCameraPosition.current) return

		const selection = resolveCameraSelection(
			cameras,
			activeCameraId,
			controls?.target ?? new Vector3(0, 0, 0),
			sceneCamera as PerspectiveCamera,
			transitionOverride?.current ?? sceneTransition,
			openingPose.current
		)
		const selectionKey = selection.cameraId
		const signature = cameraSelectionSignature(cameras, selection.cameraId)

		if (
			requestedSelection.current?.cameraId === selectionKey &&
			requestedSelection.current.signature === signature
		) {
			return
		}
		requestedSelection.current = { cameraId: selectionKey, signature }

		// Only animate when switching between cameras; apply property edits instantly
		// so sidebar changes don't re-trigger the transition for the active camera.
		if (previousSelectionKey.current === selectionKey) {
			// Without the opening pose: an edit to the camera in view, such as its
			// field of view, must not pull a camera with no pose of its own back to
			// where the scene opened.
			applyCameraInstantly(
				resolveCameraSelection(
					cameras,
					activeCameraId,
					controls?.target ?? new Vector3(0, 0, 0),
					sceneCamera as PerspectiveCamera,
					sceneTransition
				)
			)
		} else {
			startTransition(selection)
		}
		previousSelectionKey.current = selectionKey
		onInteractionEvent?.({
			type: 'camera_changed',
			cameraId: selection.cameraId
		})
	}, [
		activeCameraId,
		applyCameraInstantly,
		cameras,
		controls?.target,
		onInteractionEvent,
		sceneCamera,
		startTransition
	])

	useFrame(() => {
		if (transitionRuntime.current) {
			const runtime = transitionRuntime.current
			const now =
				typeof performance !== 'undefined' ? performance.now() : Date.now()
			const rawProgress = Math.min(
				1,
				Math.max(0, (now - runtime.startAtMs) / runtime.durationMs)
			)
			const easedProgress = applyEasing(rawProgress, runtime.easing)

			if (runtime.type === 'object_avoidance' && runtime.curve) {
				const samples =
					runtime.objectAvoidanceSamples ?? DEFAULT_OBJECT_AVOIDANCE_SAMPLES
				const splineProgress = Math.min(
					1,
					Math.max(0, Math.round(easedProgress * samples) / samples)
				)
				;(sceneCamera as PerspectiveCamera).position.copy(
					runtime.curve.getPoint(splineProgress)
				)
			} else {
				;(sceneCamera as PerspectiveCamera).position.lerpVectors(
					runtime.startPosition,
					runtime.endPosition,
					easedProgress
				)
			}

			;(sceneCamera as PerspectiveCamera).quaternion.slerpQuaternions(
				runtime.startQuaternion,
				runtime.endQuaternion,
				easedProgress
			)
			;(sceneCamera as PerspectiveCamera).fov =
				runtime.startFov + (runtime.endFov - runtime.startFov) * easedProgress
			;(sceneCamera as PerspectiveCamera).updateProjectionMatrix()

			if (controls?.target) {
				controls.target.lerpVectors(
					runtime.startTarget,
					runtime.endTarget,
					easedProgress
				)
				controls.update?.()
			}

			if (rawProgress >= 1) {
				if (controls?.target) {
					controls.target.copy(runtime.endTarget)
				}
				controls?.update?.()
				transitionRuntime.current = null
			}

			invalidate()
		}

		if (
			!isWaitingForStableFrame.current ||
			hasInitialFramingCompleted.current
		) {
			return
		}

		const cameraPosition = (sceneCamera as PerspectiveCamera).position
		const cameraQuaternion = (sceneCamera as PerspectiveCamera).quaternion
		const controlsTarget = controls?.target
		stabilizationFrameCount.current += 1

		const completeInitialFraming = () => {
			hasInitialFramingCompleted.current = true
			isWaitingForStableFrame.current = false
			// The view a camera with no pose of its own comes back to.
			if (previousSelectionKey.current) {
				openingPose.current = {
					cameraId: previousSelectionKey.current,
					position: cameraPosition.toArray(),
					target: (controlsTarget ?? new Vector3(0, 0, 0)).toArray()
				}
			}
			setIsFramed(true)
			onInteractionEvent?.({
				type: 'initial_framing_completed',
				cameraId: previousSelectionKey.current
			})
			onInitialFramingComplete?.()
		}

		const now =
			typeof performance !== 'undefined' ? performance.now() : Date.now()
		const startedAt = stabilizationStartedAt.current ?? now
		const stabilizationTimedOut =
			now - startedAt >= MAX_STABILIZATION_DURATION_MS
		const stabilizationFrameLimitReached =
			stabilizationFrameCount.current >= MAX_STABILIZATION_FRAMES

		if (stabilizationTimedOut || stabilizationFrameLimitReached) {
			completeInitialFraming()
			return
		}

		if (
			!previousCameraPosition.current ||
			!previousCameraQuaternion.current ||
			(controlsTarget && !previousControlsTarget.current)
		) {
			previousCameraPosition.current = cameraPosition.clone()
			previousCameraQuaternion.current = cameraQuaternion.clone()
			previousControlsTarget.current = controlsTarget
				? controlsTarget.clone()
				: null
			return
		}

		const hasStableCameraPosition =
			cameraPosition.distanceTo(previousCameraPosition.current) < 0.0001
		const hasStableCameraRotation =
			1 - Math.abs(cameraQuaternion.dot(previousCameraQuaternion.current)) <
			0.0001
		const hasStableControlsTarget = controlsTarget
			? controlsTarget.distanceTo(
					previousControlsTarget.current ?? controlsTarget
				) < 0.0001
			: true

		if (
			hasStableCameraPosition &&
			hasStableCameraRotation &&
			hasStableControlsTarget
		) {
			stableFrameCount.current += 1
		} else {
			stableFrameCount.current = 0
		}

		previousCameraPosition.current.copy(cameraPosition)
		previousCameraQuaternion.current.copy(cameraQuaternion)
		if (controlsTarget) {
			if (!previousControlsTarget.current) {
				previousControlsTarget.current = controlsTarget.clone()
			} else {
				previousControlsTarget.current.copy(controlsTarget)
			}
		}

		if (stableFrameCount.current >= 2) {
			completeInitialFraming()
			return
		}

		invalidate()
	})

	return null
}

export default SceneCamera
