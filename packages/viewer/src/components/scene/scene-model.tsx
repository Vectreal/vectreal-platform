import { useBounds } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { memo, useCallback, useEffect } from 'react'
import { Mesh, Object3D, PerspectiveCamera, Vector3 } from 'three'

import type {
	SceneScreenshotCapture,
	SceneScreenshotOptions
} from '../../types/viewer-types'

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
}

type OrbitControlsLike = {
	enabled?: boolean
	target: Vector3
	update: () => void
}

const DEFAULT_SCREENSHOT_OPTIONS: Required<SceneScreenshotOptions> = {
	width: 1280,
	height: 720,
	mimeType: 'image/webp',
	quality: 0.86,
	mode: 'auto-fit'
}

const waitForNextFrame = async () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const buildScreenshotDataUrl = async (
	sourceCanvas: HTMLCanvasElement,
	options: Required<SceneScreenshotOptions>
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
		onScreenshot,
		onScreenshotCaptureReady,
		enableShadows = false
	} = props
	const bounds = useBounds()
	const { camera, controls, gl, invalidate, scene } = useThree((state) => ({
		camera: state.camera,
		controls: state.controls as unknown as OrbitControlsLike | undefined,
		gl: state.gl,
		invalidate: state.invalidate,
		scene: state.scene
	}))

	const captureScreenshot = useCallback<SceneScreenshotCapture>(
		async (inputOptions) => {
			const options = {
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
				if (options.mode === 'auto-fit') {
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
		[bounds, camera, controls, gl, invalidate, object, onScreenshot, scene]
	)

	useEffect(() => {
		if (!enableShadows) {
			return
		}

		// Enable shadow casting for all meshes in the model
		object.traverse((child) => {
			if (child instanceof Mesh) {
				child.castShadow = true
				child.receiveShadow = true
			}
		})
	}, [enableShadows, object])

	useEffect(() => {
		onScreenshotCaptureReady?.(captureScreenshot)

		return () => {
			onScreenshotCaptureReady?.(null)
		}
	}, [captureScreenshot, onScreenshotCaptureReady])

	return (
		<group name="focus-target" dispose={null}>
			<primitive object={object} />
		</group>
	)
})
export default SceneModel
