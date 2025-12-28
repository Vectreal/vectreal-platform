import { memo, useEffect } from 'react'
import { Object3D } from 'three'

interface ModelProps {
	/**
	 * The 3D object (three.js `Object3D`) to render in the scene.
	 */
	object: Object3D
	/**
	 * The callback function to execute when creating a screenshot of the model after loading.
	 */
	onScreenshot?: (dataUrl: string) => void
}

/**
 * SceneModel component that renders a 3D model in a `Stage`.
 */
const SceneModel = memo((props: ModelProps) => {
	const { object } = props

	useEffect(() => {
		// Potentially add logic here to handle onScreenshot after model is loaded
	}, [object, props.onScreenshot])

	return (
		<group name="focus-target" dispose={null}>
			<primitive object={object} />
		</group>
	)
})
export default SceneModel
