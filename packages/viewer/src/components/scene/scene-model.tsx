import { useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { resolveNormalizedScale } from '@vctrl/core'
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type RefObject
} from 'react'
import {
	Box3,
	Mesh,
	Object3D,
	PerspectiveCamera,
	Sphere,
	Texture,
	Vector3
} from 'three'

import { resolveClipPlanes, type ClipExtentRegistry } from './clip-planes'
import { useModelFrame, type ModelKey } from './model-frame'
import { worldBounds } from './model-measurement'
import { resolveCameraSelection } from './scene-camera'
import { buildCaptureCamera, type CapturePose } from './screenshot-pose'

import type {
	SceneScreenshotCapture,
	SceneScreenshotOptions
} from '../../types/viewer-types'
import type {
	CameraProps,
	NormalizationOptions,
	SceneBackdrop
} from '@vctrl/core'
import type { OpeningPose, OrbitLimits } from '@vctrl/core/scene-camera'

/**
 * Anisotropic filtering keeps textures sharp on surfaces seen at a glancing
 * angle, which a product orbit shows constantly. glTF has no field for it, so
 * loaders leave three's default of 1. Eight taps is where the visible gain
 * flattens out; hardware caps it lower on some devices.
 */
const TEXTURE_ANISOTROPY = 8

interface ModelProps {
	/**
	 * The 3D object (three.js `Object3D`) to render in the scene.
	 */
	object: Object3D
	/**
	 * Which model `object` renders. A new `object` under the same key is a new
	 * rendition of the same model, such as an optimization pass's output, and
	 * keeps the measured size and the camera where they are. Defaults to the
	 * object itself.
	 */
	modelKey?: ModelKey
	/**
	 * Drawn in place of `object`. `object` stays mounted, hidden, so everything
	 * that measures or raycasts it in world space still finds it in place.
	 */
	displayedObject?: Object3D
	/**
	 * The callback function to execute when creating a screenshot of the model after loading.
	 */
	onScreenshot?: (dataUrl: string) => void
	onScreenshotCaptureReady?: (capture: null | SceneScreenshotCapture) => void
	enableShadows?: boolean
	normalizationOptions?: NormalizationOptions
	/**
	 * Called with the raw (pre-normalization) bounding-box diagonal whenever the model object changes.
	 */
	onRawDiagonalComputed?: (diagonal: number) => void
	/**
	 * Camera configuration containing the list of available cameras.
	 * Used to resolve target camera positions when capturing with targetCameraId.
	 */
	cameraOptions?: CameraProps
	/**
	 * Everything else the viewer draws (the shadow ground, the light handle),
	 * which the clip planes have to contain along with the model.
	 */
	clipExtents?: ClipExtentRegistry
	/**
	 * Where the scene opened, which `SceneCamera` records once framing
	 * completes. A capture from a camera with no pose of its own renders from
	 * there, as the viewer shows it.
	 */
	openingPose: RefObject<OpeningPose | null>
	/**
	 * The backdrop the viewer paints behind its transparent canvas. Painted
	 * under the screenshot too, so a thumbnail shows the scene as it is seen.
	 */
	backdrop?: SceneBackdrop | null
}

type OrbitControlsLike = OrbitLimits & {
	enabled?: boolean
	target: Vector3
	update: () => void
}

const DEFAULT_SCREENSHOT_OPTIONS = {
	width: 1280,
	height: 720,
	mimeType: 'image/webp' as const,
	quality: 0.86,
	mode: 'auto-fit' as const
}

const waitForNextFrame = async () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** Leaves a little air around the model instead of framing it edge to edge. */
const AUTO_FIT_MARGIN = 1.12
/** Lifts the camera slightly so the model is seen from just above eye level. */
const AUTO_FIT_ELEVATION = 0.06

/**
 * Works out where the camera has to sit to frame an object completely.
 *
 * Keeps whatever direction the camera is already looking from, so an auto-fit
 * capture respects how the user has orbited the scene, and only solves for the
 * distance. Returns null for an object with no measurable bounds, in which case
 * the caller should leave the camera alone.
 */
function solveAutoFitFraming(
	object: Object3D,
	camera: PerspectiveCamera
): null | { position: Vector3; target: Vector3 } {
	// setFromObject reads matrixWorld off every descendant. A capture can be
	// requested before the renderer has run a frame for the current state, so
	// refresh the branch first rather than measuring stale transforms.
	object.updateWorldMatrix(true, true)

	const box = new Box3().setFromObject(object)
	if (box.isEmpty()) return null

	const sphere = box.getBoundingSphere(new Sphere())
	if (!(sphere.radius > 0)) return null

	// Fit against the tighter of the two axes so nothing is cropped on a
	// non-square viewport. getEffectiveFOV folds in camera.zoom, which is what
	// three actually renders with — `fov` alone would over-frame a zoomed camera.
	const verticalFov = (camera.getEffectiveFOV() * Math.PI) / 180
	const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
	const limitingFov = Math.min(verticalFov, horizontalFov)
	const distance = (sphere.radius / Math.sin(limitingFov / 2)) * AUTO_FIT_MARGIN

	const target = sphere.center.clone()
	// Fall back to a three-quarter view when the camera sits exactly on the
	// target and there is no direction to preserve.
	const direction = camera.position.clone().sub(target)
	if (direction.lengthSq() === 0) {
		direction.set(1, 0.5, 1)
	}
	direction.normalize()

	return {
		target,
		position: target
			.clone()
			.add(direction.multiplyScalar(distance))
			.add(new Vector3(0, distance * AUTO_FIT_ELEVATION, 0))
	}
}

const buildScreenshotDataUrl = async (
	sourceCanvas: HTMLCanvasElement,
	options: Required<Omit<SceneScreenshotOptions, 'targetCameraId'>>,
	backdrop?: SceneBackdrop | null
): Promise<string> => {
	const outputCanvas = document.createElement('canvas')
	outputCanvas.width = options.width
	outputCanvas.height = options.height

	const context = outputCanvas.getContext('2d')
	if (!context) {
		throw new Error('Failed to initialize screenshot canvas context')
	}

	const sourceWidth = sourceCanvas.width
	const sourceHeight = sourceCanvas.height
	const sourceAspect = sourceWidth / sourceHeight
	const outputAspect = options.width / options.height

	let cropWidth = sourceWidth
	let cropHeight = sourceHeight
	let cropX = 0
	let cropY = 0

	if (sourceAspect > outputAspect) {
		cropWidth = sourceHeight * outputAspect
		cropX = (sourceWidth - cropWidth) / 2
	} else {
		cropHeight = sourceWidth / outputAspect
		cropY = (sourceHeight - cropHeight) / 2
	}

	if (backdrop) {
		if (backdrop.type === 'color') {
			context.fillStyle = backdrop.color
		} else {
			// The CSS gradient spans the whole viewer, and the capture is a crop
			// of it, so the gradient runs between where the viewer's top and
			// bottom edges land in the output rather than the output's own.
			const scale = options.height / cropHeight
			const gradient = context.createLinearGradient(
				0,
				-cropY * scale,
				0,
				(sourceHeight - cropY) * scale
			)
			gradient.addColorStop(0, backdrop.top)
			gradient.addColorStop(1, backdrop.bottom)
			context.fillStyle = gradient
		}
		context.fillRect(0, 0, options.width, options.height)
	}

	context.drawImage(
		sourceCanvas,
		cropX,
		cropY,
		cropWidth,
		cropHeight,
		0,
		0,
		options.width,
		options.height
	)

	return outputCanvas.toDataURL(options.mimeType, options.quality)
}

/**
 * Renders the loaded model, applies runtime size normalization, and owns the
 * per-frame near/far plane management and screenshot capture. Framing is handled
 * by `SceneBounds` and `SceneCamera`; the viewer does not use Drei's `Stage`.
 */
const SceneModel = memo((props: ModelProps) => {
	const {
		object,
		displayedObject,
		modelKey,
		cameraOptions,
		onScreenshot,
		onScreenshotCaptureReady,
		backdrop,
		enableShadows = false,
		normalizationOptions,
		onRawDiagonalComputed,
		clipExtents,
		openingPose
	} = props
	const bounds = useBounds()
	const { camera, controls, gl, invalidate, scene, size } = useThree(
		(state) => ({
			camera: state.camera,
			controls: state.controls as unknown as OrbitControlsLike | undefined,
			gl: state.gl,
			invalidate: state.invalidate,
			scene: state.scene,
			size: state.size
		})
	)

	const frame = useModelFrame(object, modelKey)
	const drawnObjects = useMemo(
		() => (displayedObject ? [object, displayedObject] : [object]),
		[object, displayedObject]
	)
	const rawDiagonal = frame?.rawDiagonal ?? 0

	const normalizedScale = useMemo(
		() => resolveNormalizedScale(rawDiagonal, normalizationOptions),
		[rawDiagonal, normalizationOptions]
	)

	// Dynamic camera clipping planes. drei's one-shot `.clip()` sets near/far tight
	// to the bounding box at the fit distance, then clips the model the moment the
	// camera zooms closer (and normalization, which rescales the model, left stale
	// planes behind). Instead, recompute near/far every frame from the live camera
	// and the bounds of everything drawn: the model's bounding sphere plus the
	// registered `clipExtents`, since the shadow ground reaches well past the model
	// and the light handle sits outside it. The planes stay tight enough for good
	// depth precision yet always contain what is drawn. Never persisted.
	//
	// The sphere is read from the rendered group's WORLD bounds (the model sits
	// inside a <Center> wrapper that offsets it, so a local-bounds approximation
	// would mis-place the center). It only changes when the model or its scale
	// changes, so it is cached and recomputed lazily.
	const focusGroupRef = useRef<Object3D>(null)
	const clipSphereRef = useRef(new Sphere())
	const clipSphereDirtyRef = useRef(true)

	useEffect(() => {
		clipSphereDirtyRef.current = true
	}, [drawnObjects, normalizedScale])

	const fitClipPlanes = useCallback(
		(perspectiveCamera: PerspectiveCamera) => {
			if (!perspectiveCamera.isPerspectiveCamera) {
				return
			}

			if (clipSphereDirtyRef.current && focusGroupRef.current) {
				worldBounds(object).getBoundingSphere(clipSphereRef.current)
				if (clipSphereRef.current.radius > 0) {
					clipSphereDirtyRef.current = false
				}
			}

			const sphere = clipSphereRef.current
			if (sphere.radius <= 0) {
				return
			}

			const { near, far } = resolveClipPlanes(
				perspectiveCamera,
				sphere,
				clipExtents ?? [],
				size.height
			)

			// The resolver reads the frustum's sides from a projection built with the
			// previous planes, so its result drifts in the last bits from frame to
			// frame. Ignoring that keeps a still view still, so it can converge.
			if (
				Math.abs(perspectiveCamera.near - near) > near * 1e-6 ||
				Math.abs(perspectiveCamera.far - far) > far * 1e-6
			) {
				perspectiveCamera.near = near
				perspectiveCamera.far = far
				perspectiveCamera.updateProjectionMatrix()
			}
		},
		[clipExtents, object, size.height]
	)

	useFrame(() => fitClipPlanes(camera as PerspectiveCamera))

	useEffect(() => {
		if (rawDiagonal > 0) onRawDiagonalComputed?.(rawDiagonal)
	}, [rawDiagonal, onRawDiagonalComputed])

	const captureScreenshot = useCallback<SceneScreenshotCapture>(
		async (inputOptions) => {
			const options: Required<Omit<SceneScreenshotOptions, 'targetCameraId'>> &
				Pick<SceneScreenshotOptions, 'targetCameraId'> = {
				...DEFAULT_SCREENSHOT_OPTIONS,
				...inputOptions
			}

			const activeCamera = camera as PerspectiveCamera

			// The pose the capture renders at. A posed capture renders through a
			// camera of its own: see `buildCaptureCamera`. Viewport mode sets none
			// and renders the live frame.
			let pose: CapturePose | null = null

			if (options.targetCameraId && cameraOptions?.cameras) {
				const targetCameraConfig = cameraOptions.cameras.find(
					(c) => c.cameraId === options.targetCameraId
				)

				if (targetCameraConfig) {
					// Resolved by the viewer's camera rule, so fallbacks (a missing
					// target, fov or position) read the live values at capture start,
					// and a camera with no pose at all stands where the scene opened.
					const selection = resolveCameraSelection(
						cameraOptions.cameras,
						targetCameraConfig.cameraId,
						controls?.target?.clone() ?? new Vector3(),
						activeCamera,
						undefined,
						openingPose.current
					)

					pose = controls?.target
						? {
								position: selection.targetPosition,
								fov: selection.targetFov,
								lookAt: selection.targetLookAt,
								limits: controls
							}
						: {
								position: selection.targetPosition,
								fov: selection.targetFov,
								rotation: selection.targetRotation
							}
				}
			} else if (options.mode === 'auto-fit') {
				// Framed here rather than via drei's `bounds.fit()`, which animates
				// the camera with damping over several frames. The old code called
				// it and then immediately read `controls.target` and the camera
				// position to derive a framing, so it computed from pre-fit values
				// while the animation was still running, and rendered two frames
				// later with the camera somewhere in between. On most models that
				// left it far enough out to capture the environment and no model.
				//
				// Solving for the distance directly is deterministic, which also
				// makes a thumbnail reproducible instead of timing-dependent.
				const framing = solveAutoFitFraming(object, activeCamera)

				if (framing) {
					// The distance was solved for this fov; hold it.
					pose = {
						position: framing.position,
						fov: activeCamera.fov,
						lookAt: framing.target,
						limits: controls
					}
				}
			}

			// Two frames let the scene settle before the render.
			invalidate()
			await waitForNextFrame()
			invalidate()
			await waitForNextFrame()

			try {
				if (pose) {
					const captureCamera = buildCaptureCamera(activeCamera, pose)
					// The live camera's planes were solved for where it is; the pose
					// needs its own, or a model nearer or farther is clipped away.
					fitClipPlanes(captureCamera)
					gl.render(scene, captureCamera)
				} else {
					gl.render(scene, activeCamera)
				}

				const dataUrl = await buildScreenshotDataUrl(
					gl.domElement,
					options,
					backdrop
				)
				onScreenshot?.(dataUrl)
				return dataUrl
			} finally {
				// The render replaced the live frame with the capture's.
				invalidate()
			}
		},
		[
			backdrop,
			camera,
			cameraOptions,
			controls,
			fitClipPlanes,
			gl,
			invalidate,
			object,
			onScreenshot,
			openingPose,
			scene
		]
	)

	useLayoutEffect(() => {
		for (const drawn of drawnObjects) {
			drawn.traverse((child) => {
				if (child instanceof Mesh) {
					child.castShadow = enableShadows
					child.receiveShadow = enableShadows
				}
			})
		}
	}, [enableShadows, drawnObjects])

	useLayoutEffect(() => {
		const anisotropy = Math.min(
			TEXTURE_ANISOTROPY,
			gl.capabilities.getMaxAnisotropy()
		)
		for (const drawn of drawnObjects) {
			drawn.traverse((child) => {
				if (!(child instanceof Mesh)) return
				const materials = Array.isArray(child.material)
					? child.material
					: [child.material]
				for (const material of materials) {
					for (const value of Object.values(material)) {
						if (!(value instanceof Texture) || value.anisotropy >= anisotropy)
							continue
						value.anisotropy = anisotropy
						// Sampler state is set on upload; a texture already on the GPU
						// (the same model shown again) has to be re-uploaded to take it.
						value.needsUpdate = true
					}
				}
			})
		}
	}, [gl, drawnObjects])

	// Refit when normalization toggles, or a new model loads while normalization
	// is already on. Keyed on the frame rather than the object: a rendition of the
	// same model (an optimization pass) must leave the camera where the user put
	// it. Skips the initial mount when normalization is off so SceneCamera can
	// handle first framing.
	const objectRef = useRef(object)
	objectRef.current = object
	const mountedRef = useRef(false)
	useEffect(() => {
		const isFirstMount = !mountedRef.current
		mountedRef.current = true
		if (isFirstMount && !normalizationOptions?.enabled) return
		// Framing only — near/far are handled dynamically by the useFrame above, so
		// rescaling/normalization no longer leaves stale clipping planes behind.
		bounds.refresh(objectRef.current).fit()
	}, [bounds, normalizationOptions?.enabled, frame])

	useEffect(() => {
		onScreenshotCaptureReady?.(captureScreenshot)

		return () => {
			onScreenshotCaptureReady?.(null)
		}
	}, [captureScreenshot, onScreenshotCaptureReady])

	return (
		<group
			ref={focusGroupRef}
			name="focus-target"
			scale={normalizedScale}
			dispose={null}
		>
			<group visible={!displayedObject}>
				<primitive object={object} />
			</group>
			{displayedObject && <primitive object={displayedObject} />}
		</group>
	)
})
export default SceneModel
