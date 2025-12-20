import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { ControlsProps } from '@vctrl/core'
import { useEffect, useRef, useState } from 'react'
import { Box3, Object3D, Vector3 } from 'three'

export const defaultControlsOptions = {
	controlsTimeout: 0,
	maxPolarAngle: Math.PI / 2,
	autoRotate: false,
	autoRotateSpeed: 0.25,
	enableZoom: true,
	zoomSpeed: 0.4,
	panSpeed: 0.5,
	rotateSpeed: 0.5,
	enableDamping: true,
	dampingFactor: 0.2,
	makeDefault: true
} satisfies ControlsProps

/**
 * SceneControls component that enables orbit controls after a specified timeout.
 */
const SceneControls = (props: ControlsProps) => {
	const { controlsTimeout, ...rest } = {
		...defaultControlsOptions,
		...props
	}

	const mountedRef = useRef(false)
	const [target, setTarget] = useState(new Vector3(0, 0, 0))
	const [isControlsEnabled, setIsControlsEnabled] = useState(
		controlsTimeout === 0
	)
	const { scene } = useThree()

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [mountedRef])

	useEffect(() => {
		if (!mountedRef.current) return

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
