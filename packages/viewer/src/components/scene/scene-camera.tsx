import { PerspectiveCamera, PerspectiveCameraProps } from '@react-three/drei'

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

	return <PerspectiveCamera {...cameraOptions} />
}

export default SceneCamera
