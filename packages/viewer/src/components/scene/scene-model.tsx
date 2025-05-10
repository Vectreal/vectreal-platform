import { Stage } from '@react-three/drei'
import { Object3D } from 'three'

import { defaultEnvOptions, EnvProps } from './scene-environment'

interface ModelProps {
	/**
	 * The 3D object (three.js `Object3D`) to render in the scene.
	 */
	object: null | Object3D

	/**
	 * Environment options - specifically the props available on the "@react-three/drei" `Stage` component.
	 */
	envOptions?: EnvProps['stage']
}

/**
 * SceneModel component that renders a 3D model in a `Stage`.
 */
const SceneModel = (props: ModelProps) => {
	const { object, envOptions } = {
		...props,
		envOptions: {
			...defaultEnvOptions.stage,
			...props.envOptions
		}
	}

	if (!object) return null

	return (
		<Stage {...envOptions}>
			<primitive object={object || new Object3D()} />
		</Stage>
	)
}

export default SceneModel
