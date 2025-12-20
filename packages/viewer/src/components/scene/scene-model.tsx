import useSceneScreenshot from '@shared/components/hooks/use-scene-screenshot'
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
	const { object, onScreenshot } = props

	const captureScreenshot = useSceneScreenshot()

	useEffect(() => {
		if (!object) return

		object.traverse((child) => {
			if (child instanceof Object3D) {
				child.castShadow = true
				child.receiveShadow = true
			}
		})
	}, [object])

	useEffect(() => {
		const timeout = setTimeout(() => {
			if (!onScreenshot) return

			const url = captureScreenshot()
			onScreenshot(url)
		}, 1000)
		return () => clearTimeout(timeout)
	}, [captureScreenshot, onScreenshot])

	return (
		<group name="focus-target" dispose={null}>
			<primitive object={object} />
		</group>
	)
})
export default SceneModel
