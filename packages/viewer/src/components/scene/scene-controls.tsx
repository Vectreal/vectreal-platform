import { OrbitControls } from '@react-three/drei'
import { ControlsProps } from '@vctrl/core'
import { memo, useEffect, useRef, useState } from 'react'

interface SceneControlsProps extends ControlsProps {
	enabledOverride?: boolean | null
}

export const defaultControlsOptions = {
	controlsTimeout: 0,
	maxPolarAngle: Math.PI / 2,
	autoRotate: false,
	autoRotateSpeed: 0.25,
	enableZoom: true,
	zoomSpeed: 0.4,
	panSpeed: 0.5,
	rotateSpeed: 0.5,
	enableDamping: false,
	dampingFactor: 0.12,
	makeDefault: true
} satisfies ControlsProps

/**
 * SceneControls component that enables orbit controls after a specified timeout.
 */
const SceneControls = memo((props: SceneControlsProps) => {
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

	return (
		<OrbitControls
			enabled={props.enabledOverride ?? isControlsEnabled}
			{...rest}
		/>
	)
})
export default SceneControls
