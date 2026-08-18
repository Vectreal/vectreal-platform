import { useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
	Box3,
	Euler,
	Mesh,
	Object3D,
	PerspectiveCamera,
	Sphere,
	Vector3
} from 'three'

import type {
	SceneScreenshotCapture,
	SceneScreenshotOptions
} from '../../types/viewer-types'
import type { CameraProps, NormalizationOptions } from '@vctrl/core'

interface ModelProps {
	/**
	 * The 3D object (three.js `Object3D`) to render in the scene.
	 */
	object: Object3D
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
}

type OrbitControlsLike = {
	enabled?: boolean
	target: Vector3
	update: () => void
}

const NORMALIZATION_DEFAULT_MIN_SIZE = 0.5
const NORMALIZATION_DEFAULT_MAX_SIZE = 5

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
	const horizontalFov =
		2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
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
	options: Required<Omit<SceneScreenshotOptions, 'targetCameraId'>>
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
		cameraOptions,
		onScreenshot,
		onScreenshotCaptureReady,
		enableShadows = false,
		normalizationOptions,
		onRawDiagonalComputed,
	} = props
	const bounds = useBounds()
	const { camera, controls, gl, invalidate, scene } = useThree((state) => ({
		camera: state.camera,
		controls: state.controls as unknown as OrbitControlsLike | undefined,
		gl: state.gl,
		invalidate: state.invalidate,
		scene: state.scene
	}))

	const rawDiagonal = useMemo(() => {
		const box = new Box3().setFromObject(object)
		return box.getSize(new Vector3()).length()
	}, [object])

	const normalizedScale = useMemo(() => {
		if (!normalizationOptions?.enabled || rawDiagonal <= 0) return 1
		const min = normalizationOptions.minSize ?? NORMALIZATION_DEFAULT_MIN_SIZE
		const max = normalizationOptions.maxSize ?? NORMALIZATION_DEFAULT_MAX_SIZE
		if (rawDiagonal < min) return min / rawDiagonal
		if (rawDiagonal > max) return max / rawDiagonal
		return 1
	}, [rawDiagonal, normalizationOptions])

	// Dynamic camera clipping planes. drei's one-shot `.clip()` sets near/far tight
	// to the bounding box at the fit distance, then clips the model the moment the
	// camera zooms closer (and normalization, which rescales the model, left stale
	// planes behind). Instead, recompute near/far every frame from the model's
	// bounding sphere and the live camera distance: the planes stay tight enough for
	// good depth precision yet always contain the model. Never persisted.
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
	}, [object, normalizedScale])

	useFrame(() => {
		const perspectiveCamera = camera as PerspectiveCamera
		if (!perspectiveCamera.isPerspectiveCamera) {
			return
		}

		if (clipSphereDirtyRef.current && focusGroupRef.current) {
			focusGroupRef.current.updateWorldMatrix(true, true)
			new Box3()
				.setFromObject(focusGroupRef.current)
				.getBoundingSphere(clipSphereRef.current)
			if (clipSphereRef.current.radius > 0) {
				clipSphereDirtyRef.current = false
			}
		}

		const sphere = clipSphereRef.current
		if (sphere.radius <= 0) {
			return
		}

		const distance = perspectiveCamera.position.distanceTo(sphere.center)
		const radius = sphere.radius
		// Margins keep the model's front/back just inside the planes.
		const near = Math.max(distance - radius * 1.1, radius * 0.001, 1e-4)
		const far = distance + radius * 1.1

		if (perspectiveCamera.near !== near || perspectiveCamera.far !== far) {
			perspectiveCamera.near = near
			perspectiveCamera.far = far
			perspectiveCamera.updateProjectionMatrix()
		}
	})

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
			const initialCameraPosition = activeCamera.position.clone()
			const initialCameraQuaternion = activeCamera.quaternion.clone()
			const initialFov = activeCamera.fov
			const initialZoom = activeCamera.zoom
			const initialControlsTarget = controls?.target?.clone()
			const initialControlsEnabled = controls?.enabled

			try {
				// If a target camera ID is specified, resolve and apply that camera's settings first
				if (options.targetCameraId && cameraOptions?.cameras) {
					const targetCameraConfig = cameraOptions.cameras.find(
						(c) => c.cameraId === options.targetCameraId
					)

					if (targetCameraConfig) {
						// Apply target camera's position if available
						if (
							Array.isArray(targetCameraConfig.position) &&
							targetCameraConfig.position.length >= 3
						) {
							activeCamera.position.fromArray(
								targetCameraConfig.position as [number, number, number]
							)
						}

						// Apply target camera's rotation if available
						if (
							Array.isArray(targetCameraConfig.rotation) &&
							targetCameraConfig.rotation.length >= 3
						) {
							const euler = new Euler(
								...(targetCameraConfig.rotation as [number, number, number])
							)
							activeCamera.quaternion.setFromEuler(euler)
						}

						// Apply target camera's field of view if available
						if (typeof targetCameraConfig.fov === 'number') {
							activeCamera.fov = targetCameraConfig.fov
						}

						// Apply target camera's target/lookAt if controls exist
						if (
							controls?.target &&
							(Array.isArray(targetCameraConfig.target) ||
								Array.isArray(targetCameraConfig.lookAt))
						) {
							const targetPosition = (targetCameraConfig.target ??
								targetCameraConfig.lookAt) as
								| [number, number, number]
								| undefined
							if (targetPosition) {
								controls.target.fromArray(targetPosition)
							}
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
					if (typeof controls?.enabled === 'boolean') {
						controls.enabled = false
					}

					const framing = solveAutoFitFraming(object, activeCamera)

					if (framing) {
						activeCamera.position.copy(framing.position)
						activeCamera.lookAt(framing.target)
						controls?.target?.copy(framing.target)
					}
				}

				activeCamera.updateProjectionMatrix()
				controls?.update()
				invalidate()
				await waitForNextFrame()
				invalidate()
				await waitForNextFrame()
				gl.render(scene, activeCamera)

				const dataUrl = await buildScreenshotDataUrl(gl.domElement, options)
				onScreenshot?.(dataUrl)
				return dataUrl
			} finally {
				activeCamera.position.copy(initialCameraPosition)
				activeCamera.quaternion.copy(initialCameraQuaternion)
				activeCamera.fov = initialFov
				activeCamera.zoom = initialZoom
				activeCamera.updateProjectionMatrix()

				if (controls?.target && initialControlsTarget) {
					controls.target.copy(initialControlsTarget)
				}

				if (typeof controls?.enabled === 'boolean') {
					controls.enabled = initialControlsEnabled
				}

				controls?.update()
				invalidate()
			}
		},
		[camera, cameraOptions, controls, gl, invalidate, object, onScreenshot, scene]
	)

	useLayoutEffect(() => {
		if (!enableShadows) {
			object.traverse((child) => {
				if (child instanceof Mesh) {
					child.castShadow = false
					child.receiveShadow = false
				}
			})
			return
		}

		object.traverse((child) => {
			if (child instanceof Mesh) {
				child.castShadow = true
				child.receiveShadow = true
			}
		})
	}, [enableShadows, object])

	// Refit when normalization toggles or a new object loads while normalization is already on.
	// Skips the initial mount when normalization is off so SceneCamera can handle first framing.
	const mountedRef = useRef(false)
	useEffect(() => {
		const isFirstMount = !mountedRef.current
		mountedRef.current = true
		if (isFirstMount && !normalizationOptions?.enabled) return
		// Framing only — near/far are handled dynamically by the useFrame above, so
		// rescaling/normalization no longer leaves stale clipping planes behind.
		bounds.refresh(object).fit()
	}, [bounds, normalizationOptions?.enabled, object])

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
			<primitive object={object} />
		</group>
	)
})
export default SceneModel
