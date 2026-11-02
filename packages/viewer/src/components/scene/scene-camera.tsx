import { useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
	CameraProps,
	CameraTransitionConfig,
	CameraTransitionType
} from '@vctrl/core'
import {
	cameraSelectionSignature,
	DEFAULT_CAMERA,
	resolveCameraPose,
	type CameraSelectionSignature,
	type OpeningPose
} from '@vctrl/core/scene-camera'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
	type Euler,
	type Object3D,
	PerspectiveCamera,
	Quaternion,
	Vector3
} from 'three'

import { applyInitialFraming } from './initial-framing'
import { prefersReducedMotion } from './reduced-motion'
import { useCameraFlight } from './use-camera-flight'

import type { InitialFramingControls } from './initial-framing'
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
	cameras: [DEFAULT_CAMERA]
}

interface SceneCameraProps extends CameraProps {
	boundsEnabled?: boolean
	hasContent?: boolean
	/** What the first view frames; see `applyInitialFraming`. */
	model?: Object3D | null
	onInitialFramingComplete?: () => void
	onCameraSnapshotCaptureReady?: (
		capture: null | SceneCameraSnapshotCapture
	) => void
	onInteractionEvent?: (event: ViewerInteractionEvent) => void
	onCommandExecutorReady?: (executor: null | ViewerCommandExecutor) => void
	/** A host's `set_transition`, which wins over `sceneTransition` while set. */
	transitionOverride?: RefObject<CameraTransitionConfig | null | undefined>
	/**
	 * Where the scene opened. Recorded here once framing completes, and held by
	 * the viewer so a capture can stand a camera with no pose of its own there
	 * too.
	 */
	openingPose: RefObject<OpeningPose | null>
}

export type ResolvedCameraSelection = {
	cameraId: string
	targetPosition: Vector3
	targetRotation: Euler
	targetFov: number
	targetLookAt: Vector3
	transition: CameraTransitionConfig
}

const DEFAULT_TRANSITION_DURATION_MS = 1000

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

/**
 * The camera `activeCameraId` resolves to, posed (`resolveCameraPose`), with
 * the transition the viewer flies to it with.
 */
export function resolveCameraSelection(
	cameras: CameraProps['cameras'],
	activeCameraId: CameraProps['activeCameraId'],
	currentControlsTarget: Vector3,
	sceneCamera: PerspectiveCamera,
	sceneTransition?: CameraTransitionConfig,
	openingPose: OpeningPose | null = null
): ResolvedCameraSelection {
	const pose = resolveCameraPose(
		cameras,
		activeCameraId,
		{
			position: sceneCamera.position,
			target: currentControlsTarget,
			fov: sceneCamera.fov
		},
		openingPose
	)

	return {
		cameraId: pose.cameraId,
		targetPosition: pose.position,
		targetRotation: pose.rotation,
		targetFov: pose.fov,
		targetLookAt: pose.target,
		transition: resolveTransition(sceneTransition)
	}
}

export const SceneCamera: React.FC<SceneCameraProps> = (props) => {
	const {
		boundsEnabled = true,
		hasContent: hasModel = false,
		model,
		onInitialFramingComplete,
		onCameraSnapshotCaptureReady,
		onCommandExecutorReady,
		onInteractionEvent,
		openingPose,
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
	// Read when a flight starts, for the same reason: a model swap must not
	// re-register the executor before the new model is framed.
	const modelRef = useRef(model)
	modelRef.current = model
	const flight = useCameraFlight(modelRef)

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
			const normalizedType: CameraTransitionType =
				selection.transition.type ?? 'none'
			const durationMs = Math.max(
				0,
				selection.transition.duration ?? DEFAULT_TRANSITION_DURATION_MS
			)

			// A visitor who asked for less motion arrives without the flight.
			if (
				normalizedType === 'none' ||
				durationMs === 0 ||
				prefersReducedMotion()
			) {
				flight.stop()
				applyCameraInstantly(selection)
				return
			}

			flight.start(
				{
					position: selection.targetPosition,
					target: selection.targetLookAt,
					fov: selection.targetFov
				},
				normalizedType,
				durationMs,
				selection.transition.easing
			)
		},
		[applyCameraInstantly, flight]
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
			openingPose,
			sceneCamera,
			startTransition,
			transitionOverride
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
				model,
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
			model,
			sceneTransition
		]
	)

	// The pose belongs to the framing this instance did. The viewer keeps the
	// ref, and this component unmounts with its content, before the reset below
	// can run, so it forgets the pose itself: the next model frames afresh.
	useEffect(() => {
		return () => {
			openingPose.current = null
		}
	}, [openingPose])

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
	}, [hasModel, initializeCamera, openingPose, sceneCamera])

	useEffect(() => {
		// update camera properties if props change after initialization
		if (!initializedCameraPosition.current) return

		const selection = resolveCameraSelection(
			cameras,
			activeCameraId,
			controls?.target ?? new Vector3(0, 0, 0),
			sceneCamera as PerspectiveCamera,
			transitionOverride?.current ?? sceneTransitionRef.current,
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
					sceneTransitionRef.current
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
		openingPose,
		sceneCamera,
		startTransition,
		transitionOverride
	])

	useFrame(() => {
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
