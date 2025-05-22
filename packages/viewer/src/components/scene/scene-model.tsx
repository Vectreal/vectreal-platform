import { useEffect } from 'react'
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

	useEffect(() => {
		if (!object) return

		object.traverse((child) => {
			if (child instanceof Object3D) {
				child.castShadow = true
				child.receiveShadow = true
			}
		})
	}, [object])

	return (
		<group name="focus-target" dispose={null}>
			<primitive object={object} />
		</group>
	)
}

export default SceneModel
