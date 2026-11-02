import { useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
	CameraProps,
	CameraTransitionConfig,
	CameraTransitionType
} from '@vctrl/core'
import {
	CameraFraming,
	cameraSelectionSignature,
	DEFAULT_CAMERA,
	resolveCameraPose,
	type CameraSelectionSignature,
	type OpeningPose,
	type OrbitDistanceLimits,
	type ViewportFraming
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
import { viewportAspectOf } from './viewport-aspect'

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
	/**
	 * The host's orbit distance limits. The camera layer scales them with the
	 * viewport fit (`CameraFraming.distanceLimits`), so it owns writing them.
	 */
	distanceLimits?: OrbitDistanceLimits
	/**
	 * Filled here with a reset of the viewport fit to a bounds fit, for
	 * `SceneModel`'s refit, which moves the camera outside this layer.
	 */
	framingReset?: RefObject<(() => void) | null>
}

export type ResolvedCameraSelection = {
	cameraId: string
	targetPosition: Vector3
	targetRotation: Euler
	targetFov: number
	targetLookAt: Vector3
	transition: CameraTransitionConfig
	/** The fit `targetPosition` carries for the live viewport; see `resolveCameraPose`. */
	framing: ViewportFraming | null
}

/** A camera by id, with what was stored for it (`cameraSelectionSignature`). */
type CameraSelection = {
	cameraId: string
	signature: CameraSelectionSignature
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
 * The camera `activeCameraId` resolves to, posed (`resolveCameraPose`) and
 * fitted to the live viewport, with the transition the viewer flies to it with.
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
			fov: sceneCamera.fov,
			viewportAspect: viewportAspectOf(sceneCamera)
		},
		openingPose
	)

	return {
		cameraId: pose.cameraId,
		targetPosition: pose.position,
		targetRotation: pose.rotation,
		targetFov: pose.fov,
		targetLookAt: pose.target,
		transition: resolveTransition(sceneTransition),
		framing: pose.framing
	}
}

export const SceneCamera: React.FC<SceneCameraProps> = (props) => {
	const {
		boundsEnabled = true,
		distanceLimits,
		framingReset,
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
	const size = useThree((state) => state.size)
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
	/**
	 * The camera in view, by whichever route it got there, signed as it was
	 * when it came into view. The signature tells a host following the view
	 * (`camera_changed` written back as `activeCameraId`) from an edit to the
	 * camera in view: the first must leave a flight to it playing.
	 */
	const viewSelection = useRef<CameraSelection | null>(null)
	/**
	 * The selection the props last asked for. Kept apart from the camera in
	 * view because a command (a marker click, a host call) moves the view
	 * without touching the props: compared against the view, any unrelated
	 * re-render after a command read as "the props changed" and flew back.
	 */
	const requestedSelection = useRef<CameraSelection | null>(null)

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
	const distanceLimitsRef = useRef<OrbitDistanceLimits>({})
	distanceLimitsRef.current = distanceLimits ?? {}
	/** Which fit is on screen (`CameraFraming`). Started afresh by each framing. */
	const framing = useRef<CameraFraming | null>(null)

	/*
	  The host's limits, scaled for the fit on screen. Read from the store: this
	  also runs from the framing timeout, before `controls` in this render's
	  closure has registered.
	*/
	const syncDistanceLimits = useCallback(() => {
		const orbit = getThreeState().controls as {
			minDistance?: number
			maxDistance?: number
		} | null
		if (
			!framing.current ||
			typeof orbit?.minDistance !== 'number' ||
			typeof orbit.maxDistance !== 'number'
		) {
			return
		}
		Object.assign(
			orbit,
			framing.current.distanceLimits(distanceLimitsRef.current)
		)
	}, [getThreeState])

	const flight = useCameraFlight(modelRef, () => {
		framing.current?.land()
		syncDistanceLimits()
	})

	const captureCameraSnapshot =
		useCallback<SceneCameraSnapshotCapture>(async () => {
			const activeCamera = sceneCamera as PerspectiveCamera
			const controlsTarget = controls?.target ?? new Vector3(0, 0, 0)
			// As a camera stores it: without the fit on screen (`storedPose`).
			const stored = framing.current?.storedPose(
				activeCamera.position,
				controlsTarget,
				activeCamera.aspect,
				flight.progress()
			) ?? {
				position: activeCamera.position,
				framingAspect: activeCamera.aspect
			}

			return {
				position: [stored.position.x, stored.position.y, stored.position.z],
				rotation: [
					activeCamera.rotation.x,
					activeCamera.rotation.y,
					activeCamera.rotation.z
				],
				target: [controlsTarget.x, controlsTarget.y, controlsTarget.z],
				fov: activeCamera.fov,
				framingAspect: stored.framingAspect,
				viewportAspect: activeCamera.aspect
			}
		}, [controls?.target, flight, sceneCamera])

	useEffect(() => {
		onCameraSnapshotCaptureReady?.(captureCameraSnapshot)

		return () => {
			onCameraSnapshotCaptureReady?.(null)
		}
	}, [captureCameraSnapshot, onCameraSnapshotCaptureReady])

	const applyCameraInstantly = useCallback(
		(selection: ResolvedCameraSelection) => {
			const activeCamera = sceneCamera as PerspectiveCamera
			// The pose shown now wins over a flight still playing, which would
			// otherwise land over it with a fit the framing no longer tracks.
			// Its progress is read first: a pose with no position of its own
			// stays where the flight left the camera.
			const progress = flight.progress()
			flight.stop()
			activeCamera.position.copy(selection.targetPosition)
			activeCamera.rotation.copy(selection.targetRotation)
			activeCamera.fov = selection.targetFov
			activeCamera.updateProjectionMatrix()
			framing.current?.show(selection.framing, progress)
			// Before update(), which clamps the distance to them.
			syncDistanceLimits()
			if (controls?.target) {
				controls.target.copy(selection.targetLookAt)
				controls.update?.()
			}
			invalidate()
		},
		[controls, flight, invalidate, sceneCamera, syncDistanceLimits]
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
				applyCameraInstantly(selection)
				return
			}

			// Read before `start`, which replaces the flight it measures.
			framing.current?.fly(selection.framing, flight.progress())
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
			syncDistanceLimits()
		},
		[applyCameraInstantly, flight, syncDistanceLimits]
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
			viewSelection.current = {
				cameraId: nextSelection.cameraId,
				signature: cameraSelectionSignature(cameras, nextSelection.cameraId)
			}
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
			framing.current = new CameraFraming(viewportAspectOf(sceneCamera) ?? 1)
			const selection = resolveCameraSelection(
				cameras,
				activeCameraId,
				initialControlsTarget,
				sceneCamera,
				sceneTransition
			)
			applyCameraInstantly(selection)
			// The fit about to be made frames the model for this viewport, whatever
			// the camera was framed at. Reset before it, so update() clamps it
			// against the host's own limits rather than the stored camera's fit.
			if (boundsEnabled) {
				framing.current.reset(viewportAspectOf(sceneCamera) ?? 1)
				syncDistanceLimits()
			}
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
			requestedSelection.current = {
				cameraId: selection.cameraId,
				signature: cameraSelectionSignature(cameras, selection.cameraId)
			}
			viewSelection.current = requestedSelection.current
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
			sceneTransition,
			syncDistanceLimits
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

		const inView = viewSelection.current
		// The props asking, unedited, for the camera a flight is taking the view
		// to: a host following the view (`camera_changed` written back), the
		// publisher among them. Applying it would stop the flight a command just
		// started, at its first frame. Once landed, the same request puts the
		// camera back on its stored pose, below.
		if (
			inView?.cameraId === selectionKey &&
			inView.signature === signature &&
			flight.progress() !== null
		) {
			return
		}

		// Only animate when switching between cameras; apply property edits instantly
		// so sidebar changes don't re-trigger the transition for the active camera.
		if (inView?.cameraId === selectionKey) {
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
		viewSelection.current = requestedSelection.current
		onInteractionEvent?.({
			type: 'camera_changed',
			cameraId: selection.cameraId
		})
	}, [
		activeCameraId,
		applyCameraInstantly,
		cameras,
		controls?.target,
		flight,
		onInteractionEvent,
		openingPose,
		sceneCamera,
		startTransition,
		transitionOverride
	])

	useEffect(() => {
		if (!framingReset) return
		framingReset.current = () => {
			// The refit replaces whatever a flight was flying to.
			flight.stop()
			framing.current?.reset(viewportAspectOf(sceneCamera) ?? 1)
			syncDistanceLimits()
		}
		return () => {
			framingReset.current = null
		}
	}, [flight, framingReset, sceneCamera, syncDistanceLimits])

	// The controls were recreated, or the host changed its limits: either way
	// the controls now hold the host's raw limits, whether or not the fit moved.
	useEffect(() => {
		syncDistanceLimits()
	}, [
		controls,
		distanceLimits?.maxDistance,
		distanceLimits?.minDistance,
		syncDistanceLimits
	])

	/*
	  The viewport changed shape: refit what is on screen, or both ends of a
	  flight (`CameraFraming.refit`). Once per resize, with no allocations, and
	  not debounced: a debounce would hold the old fit while a container
	  animates and then jump. An orthographic camera is not fitted.
	*/
	useEffect(() => {
		const aspect = viewportAspectOf(sceneCamera)
		const target = controls?.target
		if (!framing.current || aspect === undefined || !target) return
		const moved = framing.current.refit(
			aspect,
			{ position: sceneCamera.position, target },
			flight.ends()
		)
		if (!moved) return

		syncDistanceLimits()
		controls?.update?.()
		invalidate()
	}, [
		controls,
		flight,
		invalidate,
		sceneCamera,
		size.height,
		size.width,
		syncDistanceLimits
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
			// The view a camera with no pose of its own comes back to, stored
			// without the fit on screen so it is fitted afresh wherever it is shown.
			if (viewSelection.current && framing.current) {
				const target = controlsTarget ?? new Vector3(0, 0, 0)
				const stored = framing.current.storedPose(
					cameraPosition,
					target,
					(sceneCamera as PerspectiveCamera).aspect
				)
				openingPose.current = {
					cameraId: viewSelection.current.cameraId,
					position: stored.position.toArray(),
					target: target.toArray(),
					framingAspect: stored.framingAspect
				}
			}
			setIsFramed(true)
			onInteractionEvent?.({
				type: 'initial_framing_completed',
				cameraId: viewSelection.current?.cameraId ?? null
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
