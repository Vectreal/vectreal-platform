import { PerspectiveCamera, PerspectiveCameraProps } from '@react-three/drei'
import { Vector3 } from 'three'

export type RequiredCameraProps = Required<
	Pick<PerspectiveCameraProps, 'position' | 'fov' | 'aspect' | 'near' | 'far'>
>

export const defaultCameraOptions: RequiredCameraProps = {
	aspect: 1,
	position: new Vector3(3, 0, 0),
	fov: 69,
	near: 0.01,
	far: 1000
}

/**
 * Configures the Three.js camera using provided props.
 *
 * @param {CameraProps} props - Camera configuration.
 */
const SceneCamera = (props: PerspectiveCameraProps) => {
	const cameraOptions = { ...defaultCameraOptions, ...props }

	return <PerspectiveCamera makeDefault {...cameraOptions} />
}

export default SceneCamera
