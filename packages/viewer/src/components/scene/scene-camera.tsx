import { useBounds } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CameraProps } from '@vctrl/core'
import { useCallback, useEffect, useRef } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'

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

export const SceneCamera: React.FC<CameraProps> = (props) => {
	const { cameras } = { ...defaultCameraOptions, ...props }
	const initialCamera =
		cameras?.find((cam) => cam.initial) || defaultCameraOptions.cameras?.at(0)

	const { camera: sceneCamera } = useThree()
	const bounds = useBounds()

	const initializedCameraPosition = useRef(false)

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

			initializedCameraPosition.current = true
		},
		[cameras]
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

	return null
}

export default SceneCamera
