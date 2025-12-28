import { OrbitControls } from '@react-three/drei'
import { ControlsProps } from '@vctrl/core'
import { memo, useEffect, useRef, useState } from 'react'

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
const SceneControls = memo((props: ControlsProps) => {
	const { controlsTimeout, ...rest } = {
		...defaultControlsOptions,
		...props
	}

	const mountedRef = useRef(false)
	const [isControlsEnabled, setIsControlsEnabled] = useState(
		controlsTimeout === 0
	)

	useEffect(() => {
		if (mountedRef.current) return
		mountedRef.current = true

		return () => {
			mountedRef.current = false
		}
	}, [mountedRef])

	useEffect(() => {
		if (!controlsTimeout) return

		const timeoutId = setTimeout(() => {
			setIsControlsEnabled(true)
		}, controlsTimeout)

		return () => clearTimeout(timeoutId)
	}, [controlsTimeout])

	return <OrbitControls enabled={isControlsEnabled} {...rest} />
})
export default SceneControls
