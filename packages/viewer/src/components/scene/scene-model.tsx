import { Object3D } from 'three'

interface ModelProps {
	/**
	 * The 3D object (three.js `Object3D`) to render in the scene.
	 */
	object: Object3D
}

/**
 * SceneModel component that renders a 3D model in a `Stage`.
 */
const SceneModel = (props: ModelProps) => {
	const { object } = {
		...props
	}

	if (!object) return null

	return <primitive object={object} />
}

export default SceneModel
