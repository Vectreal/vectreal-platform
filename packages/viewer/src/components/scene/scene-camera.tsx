import { useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
	CameraProps,
	CameraTransitionConfig,
	CameraTransitionEasing,
	CameraTransitionType
} from '@vctrl/core'
import { useCallback, useEffect, useRef } from 'react'
import {
	CatmullRomCurve3,
	Euler,
	PerspectiveCamera,
	Quaternion,
	Vector3,
	Vector3Tuple
} from 'three'

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
	cameras: [
		{
			cameraId: 'default',
			name: 'Default Camera',
			fov: 60,
			initial: true,
			transition: {
				type: 'linear',
				duration: 1000,
				easing: 'ease_in_out'
			}
		}
	]
}

interface SceneCameraProps extends CameraProps {
	onInitialFramingComplete?: () => void
	onCameraSnapshotCaptureReady?: (
		capture: null | SceneCameraSnapshotCapture
	) => void
	onInteractionEvent?: (event: ViewerInteractionEvent) => void
	onCommandExecutorReady?: (executor: null | ViewerCommandExecutor) => void
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
	cameraEntry: NonNullable<CameraProps['cameras']>[number]
): CameraTransitionConfig {
	if (cameraEntry.transition?.type) {
		return cameraEntry.transition
	}

	if (cameraEntry.shouldAnimate === false) {
		return { type: 'none' }
	}

	return {
		type: 'linear',
		duration:
			cameraEntry.animationConfig?.duration ?? DEFAULT_TRANSITION_DURATION_MS,
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
	sceneCamera: PerspectiveCamera
): ResolvedCameraSelection {
	const selectedCamera =
		cameras?.find((camera) => camera.cameraId === activeCameraId) ??
		cameras?.find((camera) => camera.initial) ??
		cameras?.[0] ??
		defaultCameraOptions.cameras?.[0]

	const transition = selectedCamera
		? resolveTransition(selectedCamera)
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
		onInitialFramingComplete,
		onCameraSnapshotCaptureReady,
		onCommandExecutorReady,
		onInteractionEvent
	} = props
	const { cameras, activeCameraId } = { ...defaultCameraOptions, ...props }
	const MAX_STABILIZATION_FRAMES = 24
	const MAX_STABILIZATION_DURATION_MS = 500

	const { camera: sceneCamera } = useThree()
	const invalidate = useThree((state) => state.invalidate)
	const controls = useThree((state) => state.controls) as
		| {
				target?: Vector3
				update?: () => void
		  }
		| undefined
	const bounds = useBounds()

	const initializedCameraPosition = useRef(false)
	const hasInitialFramingCompleted = useRef(false)
	const isWaitingForStableFrame = useRef(false)
	const stableFrameCount = useRef(0)
	const previousCameraPosition = useRef<Vector3 | null>(null)
	const previousCameraQuaternion = useRef<Quaternion | null>(null)
	const previousControlsTarget = useRef<Vector3 | null>(null)
	const stabilizationFrameCount = useRef(0)
	const stabilizationStartedAt = useRef<number | null>(null)
	const transitionRuntime = useRef<CameraTransitionRuntime | null>(null)
	const previousSelectionKey = useRef<string | null>(null)
	const previousSelectionSignature = useRef<string | null>(null)

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
				sceneCamera as PerspectiveCamera
			)

			if (nextSelection.cameraId !== command.cameraId) {
				return
			}

			startTransition(nextSelection)
			previousSelectionKey.current = nextSelection.cameraId
			previousSelectionSignature.current = JSON.stringify({
				position: nextSelection.targetPosition.toArray(),
				target: nextSelection.targetLookAt.toArray(),
				rotation: [
					nextSelection.targetRotation.x,
					nextSelection.targetRotation.y,
					nextSelection.targetRotation.z
				],
				fov: nextSelection.targetFov,
				transition: nextSelection.transition
			})
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
		// Expose the smallest imperative runtime surface possible so app layers can
		// drive viewer state without reaching into camera internals.
		onCommandExecutorReady?.({ execute: executeViewerCommand })
		onInteractionEvent?.({ type: 'viewer_ready' })

		return () => {
			onCommandExecutorReady?.(null)
		}
	}, [executeViewerCommand, onCommandExecutorReady, onInteractionEvent])

	const initializeCamera = useCallback(
		(sceneCamera: PerspectiveCamera) => {
			const initialControlsTarget = controls?.target ?? new Vector3(0, 0, 0)
			const selection = resolveCameraSelection(
				cameras,
				activeCameraId,
				initialControlsTarget,
				sceneCamera
			)
			applyCameraInstantly(selection)

			bounds.reset().fit()

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
			previousSelectionSignature.current = JSON.stringify({
				position: selection.targetPosition.toArray(),
				target: selection.targetLookAt.toArray(),
				rotation: [
					selection.targetRotation.x,
					selection.targetRotation.y,
					selection.targetRotation.z
				],
				fov: selection.targetFov,
				transition: selection.transition
			})
		},
		[activeCameraId, applyCameraInstantly, bounds, cameras, controls?.target]
	)

	useEffect(() => {
		if (initializedCameraPosition.current) return
		setTimeout(() => initializeCamera(sceneCamera as PerspectiveCamera), 0)
	}, [initializeCamera])

	useEffect(() => {
		// update camera properties if props change after initialization
		if (!initializedCameraPosition.current) return

		const selection = resolveCameraSelection(
			cameras,
			activeCameraId,
			controls?.target ?? new Vector3(0, 0, 0),
			sceneCamera as PerspectiveCamera
		)
		const selectionKey = selection.cameraId
		const signature = JSON.stringify({
			position: selection.targetPosition.toArray(),
			target: selection.targetLookAt.toArray(),
			rotation: [
				selection.targetRotation.x,
				selection.targetRotation.y,
				selection.targetRotation.z
			],
			fov: selection.targetFov,
			transition: selection.transition
		})

		if (
			previousSelectionKey.current === selectionKey &&
			previousSelectionSignature.current === signature
		) {
			return
		}

		startTransition(selection)
		previousSelectionKey.current = selectionKey
		previousSelectionSignature.current = signature
		onInteractionEvent?.({
			type: 'camera_changed',
			cameraId: selection.cameraId
		})
	}, [
		activeCameraId,
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

		const now =
			typeof performance !== 'undefined' ? performance.now() : Date.now()
		const startedAt = stabilizationStartedAt.current ?? now
		const stabilizationTimedOut =
			now - startedAt >= MAX_STABILIZATION_DURATION_MS
		const stabilizationFrameLimitReached =
			stabilizationFrameCount.current >= MAX_STABILIZATION_FRAMES

		if (stabilizationTimedOut || stabilizationFrameLimitReached) {
			hasInitialFramingCompleted.current = true
			isWaitingForStableFrame.current = false
			onInteractionEvent?.({
				type: 'initial_framing_completed',
				cameraId: previousSelectionKey.current
			})
			onInitialFramingComplete?.()
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
			hasInitialFramingCompleted.current = true
			isWaitingForStableFrame.current = false
			onInteractionEvent?.({
				type: 'initial_framing_completed',
				cameraId: previousSelectionKey.current
			})
			onInitialFramingComplete?.()
			return
		}

		invalidate()
	})

	return null
}

export default SceneCamera
