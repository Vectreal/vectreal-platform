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
	DEFAULT_SCENE_TRANSITION,
	isLensOnlyEdit,
	orbitAnchor,
	orbitLimitsFor,
	resolveCameraPose,
	type CameraSelectionSignature,
	type OpeningPose,
	type OrbitLimits,
	type ResolvedCameraConstraints,
	type ViewportFraming
} from '@vctrl/core/scene-camera'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
	Box3,
	type Euler,
	type Object3D,
	PerspectiveCamera,
	Quaternion,
	Vector3
} from 'three'

import { entersModel, isInsideGuard } from './camera-guard'
import { applyInitialFraming } from './initial-framing'
import { worldBounds } from './model-measurement'
import { prefersReducedMotion } from './reduced-motion'
import { viewCaptureCamera } from './screenshot-pose'
import { useCameraFlight } from './use-camera-flight'
import { viewportAspectOf } from './viewport-aspect'

import type {
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '../../types/viewer-interactions'
import type {
	SceneCameraSnapshot,
	SceneCameraSnapshotCapture,
	SceneCameraSnapshotRestore
} from '../../types/viewer-types'
import type { InitialFramingControls } from './initial-framing'

/**
 * Default camera options for the VectrealViewer.
 *
 * These defaults provide sensible values for perspective camera properties:
 * - fov: Field of view in degrees (default: 50°)
 */
export const defaultCameraOptions: CameraProps = {
	activeCameraId: 'default',
	sceneTransition: DEFAULT_SCENE_TRANSITION,
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
	onCameraSnapshotRestoreReady?: (
		restore: null | SceneCameraSnapshotRestore
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
	 * The limits that hold a visitor at a camera, by its id: its own, or the
	 * scene-wide controls for a camera without any. The camera layer anchors
	 * them on the view it lands at and scales the distances with the viewport
	 * fit (`CameraFraming.distanceLimits`), so it owns writing them.
	 */
	constraintsFor?: (cameraId: string) => ResolvedCameraConstraints
	/**
	 * The host's own editing view moves freely: the orbit point is not held
	 * inside the model. `constraintsFor` is the host's to free as well.
	 */
	freeCamera?: boolean
	/**
	 * Filled here with a reset of the viewport fit to a bounds fit, for
	 * `SceneModel`'s refit, which moves the camera outside this layer.
	 */
	framingReset?: RefObject<(() => void) | null>
	/**
	 * Filled here with a read of the view on screen as a camera stores it (the
	 * camera snapshot), for `SceneModel`'s viewport capture, which renders that
	 * pose fitted to its output.
	 */
	storedView?: RefObject<(() => SceneCameraSnapshot) | null>
	/**
	 * Filled here with a move of the orbit point to a spot on the model, for
	 * double-click to focus: the camera keeps its distance and direction and
	 * flies, or under reduced motion jumps, with the point.
	 */
	focusRequest?: RefObject<((point: Vector3) => void) | null>
}

/** A focus slides a short way, so it takes less time than a camera switch. */
export const FOCUS_FLIGHT_MS = 450

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

function resolveTransition(
	sceneTransition: CameraTransitionConfig | undefined
): CameraTransitionConfig {
	if (sceneTransition?.type) {
		return sceneTransition
	}

	return DEFAULT_SCENE_TRANSITION
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

/**
 * Whether a camera stores where it stands: a position (`framing` is set only
 * for one `resolveCameraPose` could use), or a rotation it could read.
 */
const hasOwnPose = (
	cameras: CameraProps['cameras'],
	selection: ResolvedCameraSelection
): boolean => {
	if (selection.framing) return true
	const rotation: unknown = cameras?.find(
		(entry) => entry.cameraId === selection.cameraId
	)?.rotation
	return Array.isArray(rotation)
		? rotation.length >= 3
		: typeof rotation === 'object' &&
				rotation !== null &&
				'x' in rotation &&
				'y' in rotation &&
				'z' in rotation
}

/** No limits: what the controls hold while a flight plays. */
const OPEN_LIMITS: OrbitLimits = {
	minPolarAngle: 0,
	maxPolarAngle: Math.PI,
	minAzimuthAngle: -Infinity,
	maxAzimuthAngle: Infinity,
	minDistance: 0,
	maxDistance: Infinity
}

const panDelta = new Vector3()

/** A camera's own saved position, if it has one. */
const storedPosition = (
	cameras: CameraProps['cameras'],
	cameraId: string
): null | Vector3 => {
	const position = cameras?.find(
		(camera) => camera.cameraId === cameraId
	)?.position
	return Array.isArray(position) && position.length === 3
		? new Vector3(...(position as [number, number, number]))
		: null
}
const insideBox = new Box3()

export const SceneCamera: React.FC<SceneCameraProps> = (props) => {
	const {
		boundsEnabled = true,
		constraintsFor,
		focusRequest,
		freeCamera = false,
		framingReset,
		hasContent: hasModel = false,
		model,
		onInitialFramingComplete,
		onCameraSnapshotCaptureReady,
		onCameraSnapshotRestoreReady,
		onCommandExecutorReady,
		onInteractionEvent,
		openingPose,
		storedView,
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
	const constraintsForRef = useRef(constraintsFor)
	constraintsForRef.current = constraintsFor
	const freeCameraRef = useRef(freeCamera)
	freeCameraRef.current = freeCamera
	/** Which fit is on screen (`CameraFraming`). Started afresh by each framing. */
	const framing = useRef<CameraFraming | null>(null)
	/**
	 * The camera the view was last sent to, and what its limits are anchored
	 * on: the distance and azimuth of its pose as stored (without the fit on
	 * screen). A camera with limits of its own also keeps the orbit point
	 * inside the model and its own target, wherever the author aimed it; one
	 * saved before cameras had limits pans as freely as it always did.
	 */
	const held = useRef<null | {
		cameraId: string
		constraints: ResolvedCameraConstraints
		anchor: { distance: number; azimuth: number }
		keepInside: null | Vector3
		/**
		 * Where the camera was saved, if it was: one saved inside the model (an
		 * interior shot) is not kept out of it (`isInsideGuard`). Measured
		 * against the model as it is now, without the fit on screen.
		 */
		stored: null | Vector3
	}>(null)
	/**
	 * The last pose outside the model, which a move into it goes back to
	 * (`entersModel`): one a visitor's move left, or one this layer set
	 * (`rememberPose`, on a landing, a switch, a focus, a refit). A pose this
	 * layer sets replaces it rather than being judged as a step from it; only
	 * a refit made outside the layer (`framingReset`) leaves none.
	 */
	const safePose = useRef({
		known: false,
		position: new Vector3(),
		quaternion: new Quaternion(),
		target: new Vector3()
	})
	/** Read by every sync: a flight plays with the limits open. */
	const flightRef = useRef<{ progress: () => number | null } | null>(null)

	/*
	  The held camera's limits, scaled for the fit on screen. Read from the
	  store: this also runs from the framing timeout, before `controls` in this
	  render's closure has registered. While a flight plays the limits are open,
	  so neither end of it, nor its path, is clamped; the camera it lands at
	  sets them again.
	*/
	const syncConstraints = useCallback(
		(open = false) => {
			const orbit = getThreeState().controls as Partial<OrbitLimits> | null
			if (!framing.current || typeof orbit?.minDistance !== 'number') return
			const hold = held.current
			if (open || !hold || flightRef.current?.progress() != null) {
				Object.assign(orbit, OPEN_LIMITS)
				return
			}
			const limits = orbitLimitsFor(hold.constraints, hold.anchor)
			Object.assign(orbit, limits, framing.current.distanceLimits(limits))
		},
		[getThreeState]
	)

	/** Holds the view to the camera `selection` sends it to (`held`). */
	const holdTo = useCallback(
		(selection: ResolvedCameraSelection) => {
			const resolve = constraintsForRef.current
			if (!resolve) {
				held.current = null
				return
			}
			const anchor = orbitAnchor(
				selection.targetPosition,
				selection.targetLookAt,
				sceneCamera.up
			)
			const ownsLimits = cameras?.some(
				(camera) =>
					camera.cameraId === selection.cameraId &&
					camera.constraints !== undefined
			)
			held.current = {
				cameraId: selection.cameraId,
				constraints: resolve(selection.cameraId),
				anchor: {
					distance: anchor.distance / (selection.framing?.scale ?? 1),
					azimuth: anchor.azimuth
				},
				keepInside: ownsLimits ? selection.targetLookAt.clone() : null,
				stored: storedPosition(cameras, selection.cameraId)
			}
		},
		[cameras, sceneCamera]
	)

	/**
	 * A pose this layer has just set is the one a visitor's next move is judged
	 * from, when it is outside the model; one inside it (an interior shot)
	 * leaves nothing to judge from.
	 */
	const rememberPose = useCallback(() => {
		const safe = safePose.current
		const shown = modelRef.current
		const target = (getThreeState().controls as { target?: Vector3 } | null)
			?.target
		safe.known =
			!!shown &&
			!!target &&
			!worldBounds(shown, insideBox).containsPoint(sceneCamera.position)
		if (!safe.known || !target) return
		safe.position.copy(sceneCamera.position)
		safe.quaternion.copy(sceneCamera.quaternion)
		safe.target.copy(target)
	}, [getThreeState, sceneCamera])

	const flight = useCameraFlight(modelRef, () => {
		framing.current?.land()
		syncConstraints()
		rememberPose()
	})
	flightRef.current = flight

	const readStoredView = useCallback((): SceneCameraSnapshot => {
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

	const captureCameraSnapshot = useCallback<SceneCameraSnapshotCapture>(
		async () => readStoredView(),
		[readStoredView]
	)

	useEffect(() => {
		if (!storedView) return
		storedView.current = readStoredView
		return () => {
			storedView.current = null
		}
	}, [readStoredView, storedView])

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
			safePose.current.known = false
			activeCamera.position.copy(selection.targetPosition)
			activeCamera.rotation.copy(selection.targetRotation)
			activeCamera.fov = selection.targetFov
			activeCamera.updateProjectionMatrix()
			framing.current?.show(selection.framing, progress)
			// Before update(), which clamps the distance to them.
			syncConstraints()
			if (controls?.target) {
				controls.target.copy(selection.targetLookAt)
				controls.update?.()
			}
			rememberPose()
			invalidate()
		},
		[controls, flight, invalidate, rememberPose, sceneCamera, syncConstraints]
	)

	/*
	  A snapshot back on screen, resolved like any stored camera so it is
	  fitted to the live viewport. Held for the next frame: a host restoring
	  as it changes the selection or the controls has those land first, so the
	  flight a selection starts cannot land over the view and the old limits
	  cannot clamp it. It names no camera, so the camera in view stays the one
	  the view last went to.
	*/
	const pendingRestore = useRef<null | {
		view: SceneCameraSnapshot
		onApplied?: () => void
	}>(null)

	const restoreCameraSnapshot = useCallback<SceneCameraSnapshotRestore>(
		(view, onApplied) => {
			pendingRestore.current = { view, onApplied }
			invalidate()
		},
		[invalidate]
	)

	useFrame(() => {
		const pending = pendingRestore.current
		if (!pending) return
		pendingRestore.current = null
		const viewCamera = viewCaptureCamera(pending.view)
		applyCameraInstantly(
			resolveCameraSelection(
				[viewCamera],
				viewCamera.cameraId,
				controls?.target ?? new Vector3(0, 0, 0),
				sceneCamera as PerspectiveCamera
			)
		)
		pending.onApplied?.()
	})

	useEffect(() => {
		onCameraSnapshotRestoreReady?.(restoreCameraSnapshot)
		return () => {
			onCameraSnapshotRestoreReady?.(null)
		}
	}, [onCameraSnapshotRestoreReady, restoreCameraSnapshot])

	const startTransition = useCallback(
		(selection: ResolvedCameraSelection) => {
			const normalizedType: CameraTransitionType =
				selection.transition.type ?? 'none'
			const durationMs = Math.max(
				0,
				selection.transition.duration ?? DEFAULT_SCENE_TRANSITION.duration
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
			syncConstraints()
		},
		[applyCameraInstantly, flight, syncConstraints]
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

			holdTo(nextSelection)
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
			holdTo,
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
			holdTo(selection)
			applyCameraInstantly(selection)
			// The fit about to be made frames the model for this viewport, whatever
			// the camera was framed at. Reset before it, so update() clamps it
			// against the host's own limits rather than the stored camera's fit.
			// A camera with limits of its own measures them from its view, and the
			// fit is not that view: they open for it and anchor on the view it
			// makes, below.
			const anchorsOnFit = boundsEnabled && held.current?.keepInside != null
			if (boundsEnabled) {
				framing.current.reset(viewportAspectOf(sceneCamera) ?? 1)
				syncConstraints(anchorsOnFit)
			}
			// Read from the store rather than this render's `controls`: this runs
			// from a timeout, and the fit's target is lost if it lands on a closure
			// captured before OrbitControls registered.
			applyInitialFraming(
				bounds,
				model,
				sceneCamera,
				getThreeState().controls as InitialFramingControls | null,
				boundsEnabled,
				!hasOwnPose(cameras, selection)
			)
			const fitTarget = (
				getThreeState().controls as InitialFramingControls | null
			)?.target
			if (anchorsOnFit && held.current && fitTarget) {
				const fit = orbitAnchor(sceneCamera.position, fitTarget, sceneCamera.up)
				held.current.anchor = { distance: fit.distance, azimuth: fit.azimuth }
				syncConstraints()
			}

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
			holdTo,
			model,
			sceneTransition,
			syncConstraints
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
		if (
			inView?.cameraId === selectionKey &&
			flight.progress() === null &&
			isLensOnlyEdit(inView.signature, signature)
		) {
			// A new lens is applied where the view is: an author who orbited away
			// and then changes the field of view keeps the view they were exploring.
			const activeCamera = sceneCamera as PerspectiveCamera
			activeCamera.fov = selection.targetFov
			activeCamera.updateProjectionMatrix()
			invalidate()
		} else if (inView?.cameraId === selectionKey) {
			// Without the opening pose: an edit to the camera in view must not pull
			// a camera with no pose of its own back to where the scene opened.
			const edited = resolveCameraSelection(
				cameras,
				activeCameraId,
				controls?.target ?? new Vector3(0, 0, 0),
				sceneCamera as PerspectiveCamera,
				sceneTransitionRef.current
			)
			holdTo(edited)
			applyCameraInstantly(edited)
		} else {
			holdTo(selection)
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
		holdTo,
		invalidate,
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
			// The refit moves the camera from outside this layer.
			safePose.current.known = false
			framing.current?.reset(viewportAspectOf(sceneCamera) ?? 1)
			syncConstraints()
		}
		return () => {
			framingReset.current = null
		}
	}, [flight, framingReset, sceneCamera, syncConstraints])

	useEffect(() => {
		if (!focusRequest || !controls?.target) return
		const target = controls.target
		focusRequest.current = (point) => {
			const activeCamera = sceneCamera as PerspectiveCamera
			const position = activeCamera.position.clone().add(point).sub(target)
			const progress = flight.progress()
			if (prefersReducedMotion()) {
				flight.stop()
				safePose.current.known = false
				framing.current?.show(null, progress)
				activeCamera.position.copy(position)
				target.copy(point)
				controls.update?.()
				rememberPose()
				invalidate()
				return
			}
			framing.current?.fly(null, progress)
			flight.start(
				{ position, target: point.clone(), fov: activeCamera.fov },
				'linear',
				FOCUS_FLIGHT_MS,
				'ease_in_out'
			)
			syncConstraints()
		}
		return () => {
			focusRequest.current = null
		}
	}, [
		controls,
		flight,
		focusRequest,
		invalidate,
		rememberPose,
		sceneCamera,
		syncConstraints
	])

	// The controls were recreated, or the limits changed (an edit to a camera,
	// the scene-wide controls, or the host freeing the view): the held camera's
	// limits are resolved again and written, whether or not the fit moved.
	useEffect(() => {
		const hold = held.current
		if (hold && constraintsFor) {
			hold.constraints = constraintsFor(hold.cameraId)
		}
		syncConstraints()
	}, [constraintsFor, controls, syncConstraints])

	/*
	  After each move a visitor makes, two holds, neither during a flight
	  (which owns the camera) nor in a host's editing view:
	  - For a camera with limits of its own, the orbit point stays inside the
	    model (and the camera's own target), so a visitor cannot pan the
	    subject off screen. Panning moves the camera and its target together,
	    so the camera moves back with the target and the pan stops at the box.
	  - For every camera but one saved inside the model, a move that would
	    take the camera into the model, or through it, is put back to the last
	    pose outside it (`entersModel`, `safePose`): zoom stops at the surface
	    and an orbit at the model's edge.
	*/
	useEffect(() => {
		const orbit = controls as
			| (typeof controls & {
					addEventListener?: (type: 'change', listener: () => void) => void
					removeEventListener?: (type: 'change', listener: () => void) => void
			  })
			| undefined
		if (!orbit?.target || !orbit.addEventListener) return
		const target = orbit.target
		const holdToModel = () => {
			const hold = held.current
			const shown = modelRef.current
			// A flight owns the camera, and records where it lands.
			if (flight.progress() !== null) return
			if (!hold || !shown || freeCameraRef.current) {
				safePose.current.known = false
				return
			}
			// Read now: a model swapped or refitted in place has new bounds.
			if (hold.keepInside) {
				const box = worldBounds(shown, insideBox).expandByPoint(hold.keepInside)
				panDelta.copy(target).clamp(box.min, box.max).sub(target)
				target.add(panDelta)
				sceneCamera.position.add(panDelta)
			}
			const box = worldBounds(shown, insideBox)
			if (hold.stored && isInsideGuard(hold.stored, box)) return
			const safe = safePose.current
			if (safe.known && entersModel(safe.position, sceneCamera.position, box)) {
				sceneCamera.position.copy(safe.position)
				sceneCamera.quaternion.copy(safe.quaternion)
				target.copy(safe.target)
				return
			}
			if (!box.containsPoint(sceneCamera.position)) {
				safe.known = true
				safe.position.copy(sceneCamera.position)
				safe.quaternion.copy(sceneCamera.quaternion)
				safe.target.copy(target)
			}
		}
		orbit.addEventListener('change', holdToModel)
		return () => orbit.removeEventListener?.('change', holdToModel)
	}, [controls, flight, sceneCamera])

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

		safePose.current.known = false
		syncConstraints()
		controls?.update?.()
		rememberPose()
		invalidate()
	}, [
		controls,
		flight,
		invalidate,
		rememberPose,
		sceneCamera,
		size.height,
		size.width,
		syncConstraints
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
