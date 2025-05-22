import { PerspectiveCamera, PerspectiveCameraProps } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { Box3, Object3D, Vector3 } from 'three'

type RequiredCameraProps = Required<
	Pick<PerspectiveCameraProps, 'fov' | 'aspect' | 'near' | 'far'>
>

export const defaultCameraOptions: RequiredCameraProps = {
	aspect: 1,
	fov: 69,
	near: 0.01,
	far: 1000
}

/**
 * Configures the Three.js camera using provided props.
 *
 * @param {PerspectiveCameraProps} props - Camera configuration.
 */
const SceneCamera = (props: PerspectiveCameraProps) => {
	const { ...cameraOptions } = { ...defaultCameraOptions, ...props }
	const [position, setPosition] = useState(new Vector3(0, 0, 0))

	const { scene } = useThree()

	useEffect(() => {
		const box = new Box3()

		// recursively traverse the scene to find the focus target
		const traverseScene = (object: Object3D) => {
			if (object.name === 'focus-target') {
				box.expandByObject(object)
			} else if (object.children.length > 0) {
				object.children.forEach((child) => {
					if (child instanceof Object3D) {
						traverseScene(child)
					}
				})
			}
		}

		scene.children.forEach((object) => {
			if (object instanceof Object3D) {
				traverseScene(object)
			}
		})

		const center = box.getCenter(new Vector3())
		const size = box.getSize(new Vector3())

		setPosition(center.add(new Vector3(-size.x / 2, size.y / 2, size.z * 1.5)))
	}, [scene, setPosition])

	return (
		<PerspectiveCamera position={position} makeDefault {...cameraOptions} />
	)
}

export default SceneCamera
