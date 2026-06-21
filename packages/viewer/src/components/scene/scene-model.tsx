import { useBounds } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, Euler, Mesh, Object3D, PerspectiveCamera, Vector3 } from 'three'

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
 * SceneModel component that renders a 3D model in a `Stage`.
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
							activeCamera.position.fromArray(targetCameraConfig.position)
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
					// Original auto-fit behavior when no target camera is specified
					if (typeof controls?.enabled === 'boolean') {
						controls.enabled = false
					}

					bounds.refresh(object).clip().fit()

					if (controls?.target) {
						const target = controls.target.clone()
						const direction = activeCamera.position
							.clone()
							.sub(target)
							.normalize()
						const distance = activeCamera.position.distanceTo(target)
						const distanceMultiplier = 1.08
						const elevatedPosition = target
							.clone()
							.add(direction.multiplyScalar(distance * distanceMultiplier))
							.add(new Vector3(0, distance * 0.06, 0))

						activeCamera.position.copy(elevatedPosition)
						activeCamera.lookAt(target)
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
		[
			bounds,
			camera,
			cameraOptions,
			controls,
			gl,
			invalidate,
			object,
			onScreenshot,
			scene
		]
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
		bounds.refresh(object).clip().fit()
	}, [bounds, normalizationOptions?.enabled, object])

	useEffect(() => {
		onScreenshotCaptureReady?.(captureScreenshot)

		return () => {
			onScreenshotCaptureReady?.(null)
		}
	}, [captureScreenshot, onScreenshotCaptureReady])

	return (
		<group name="focus-target" scale={normalizedScale} dispose={null}>
			<primitive object={object} />
		</group>
	)
})
export default SceneModel
