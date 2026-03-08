import { useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraProps } from '@vctrl/core'
import { useCallback, useEffect, useRef } from 'react'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'

/**
 * Default camera options for the VectrealViewer.
 *
 * These defaults provide sensible values for perspective camera properties:
 * - fov: Field of view in degrees (default: 50°)
 */
export const defaultCameraOptions: CameraProps = {
	cameras: [
		{
			cameraId: 'default',
			name: 'Default Camera',
			fov: 60,
			initial: true,
			shouldAnimate: true,
			animationConfig: {
				duration: 1000
			}
		}
	]
}

interface SceneCameraProps extends CameraProps {
	onInitialFramingComplete?: () => void
}

export const SceneCamera: React.FC<SceneCameraProps> = (props) => {
	const { onInitialFramingComplete } = props
	const { cameras } = { ...defaultCameraOptions, ...props }
	const initialCamera =
		cameras?.find((cam) => cam.initial) || defaultCameraOptions.cameras?.at(0)

	const { camera: sceneCamera } = useThree()
	const controls = useThree((state) => state.controls) as
		| {
				target?: Vector3
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

	const initializeCamera = useCallback(
		(sceneCamera: PerspectiveCamera) => {
			if (!initialCamera) return

			const { position, rotation, fov } = initialCamera

			if (position) {
				const serailizedPosition = Array.isArray(position)
					? position.map((coord) => parseFloat(coord.toString()))
					: position instanceof Vector3
						? [position.x, position.y, position.z]
						: [0, 0, 0]

				sceneCamera.position.set(
					serailizedPosition[0],
					serailizedPosition[1],
					serailizedPosition[2]
				)
			}
			if (rotation) {
				const serailizedRotation = Array.isArray(rotation)
					? rotation.map((angle) => parseFloat((angle ?? 0).toString()))
					: rotation instanceof Vector3
						? [rotation.x, rotation.y, rotation.z]
						: [0, 0, 0]
				sceneCamera.rotation.set(
					serailizedRotation[0],
					serailizedRotation[1],
					serailizedRotation[2]
				)
			}
			if (fov && sceneCamera.type === 'PerspectiveCamera') {
				// Only PerspectiveCamera has 'fov'
				sceneCamera.fov = fov
			}

			bounds.reset().fit()

			if (!hasInitialFramingCompleted.current) {
				isWaitingForStableFrame.current = true
				stableFrameCount.current = 0
				previousCameraPosition.current = null
				previousCameraQuaternion.current = null
				previousControlsTarget.current = null
			}

			initializedCameraPosition.current = true
		},
		[bounds, initialCamera]
	)

	useEffect(() => {
		if (initializedCameraPosition.current) return
		setTimeout(() => initializeCamera(sceneCamera as PerspectiveCamera), 0)
	}, [initializeCamera])

	useEffect(() => {
		// update camera properties if props change after initialization
		if (!initializedCameraPosition.current) return
		initializeCamera(sceneCamera as PerspectiveCamera)
	}, [cameras, initializeCamera, sceneCamera])

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
			onInitialFramingComplete?.()
		}
	})

	return null
}

export default SceneCamera
