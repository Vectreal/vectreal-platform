import { OrbitControls, OrbitControlsProps } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { Box3, Object3D, Vector3 } from 'three'

export interface ControlsProps extends OrbitControlsProps {
	/**
	 * The timeout duration in milliseconds before enabling the controls.
	 */
	controlsTimeout?: number
}

export const defaultControlsOptions = {
	controlsTimeout: 0,
	maxPolarAngle: Math.PI / 2,
	autoRotate: true,
	autoRotateSpeed: 0.25,
	enableZoom: true,
	zoomSpeed: 0.4,
	panSpeed: 0.5,
	rotateSpeed: 0.5,
	enableDamping: true,
	dampingFactor: 0.2
} satisfies ControlsProps

/**
 * SceneControls component that enables orbit controls after a specified timeout.
 */
const SceneControls = (props: ControlsProps) => {
	const { controlsTimeout, ...rest } = {
		...defaultControlsOptions,
		...props
	}

	const [target, setTarget] = useState(new Vector3(0, 0, 0))
	const [isControlsEnabled, setIsControlsEnabled] = useState(
		controlsTimeout === 0
	)
	const { scene } = useThree()

	useEffect(() => {
		const box = new Box3()
		scene.traverse((object) => {
			if (object instanceof Object3D) {
				box.expandByObject(object)
			}
		})
		const center = box.getCenter(new Vector3())

		setTarget(center)
	}, [scene])

	useEffect(() => {
		if (!controlsTimeout) return

		const timeoutId = setTimeout(() => {
			setIsControlsEnabled(true)
		}, controlsTimeout)

		return () => clearTimeout(timeoutId)
	}, [controlsTimeout])

	return <OrbitControls target={target} enabled={isControlsEnabled} {...rest} />
}

export default SceneControls
