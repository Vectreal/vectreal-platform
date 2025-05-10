import { OrbitControls, OrbitControlsProps } from '@react-three/drei'
import { useEffect, useState } from 'react'

export interface ControlsProps extends OrbitControlsProps {
	/**
	 * The timeout duration in milliseconds before enabling the controls.
	 */
	controlsTimeout?: number
}

export const defaultControlsOptions: ControlsProps = {
	controlsTimeout: 0,
	maxPolarAngle: Math.PI / 2,
	autoRotate: true,
	zoomSpeed: 0.25,
	panSpeed: 0.5,
	rotateSpeed: 0.5,
	enableDamping: true,
	dampingFactor: 0.25,
	maxDistance: 5
}

/**
 * SceneControls component that enables orbit controls after a specified timeout.
 */
const SceneControls = (props: ControlsProps) => {
	const { controlsTimeout, ...rest } = {
		...defaultControlsOptions,
		...props
	}

	const [isControlsEnabled, setIsControlsEnabled] = useState(
		controlsTimeout === 0
	)

	// useEffect(() => {
	// 	if (!controlsTimeout) {
	// 		return
	// 	}

	// 	const timeoutId = setTimeout(() => {
	// 		setIsControlsEnabled(true)
	// 	}, controlsTimeout)

	// 	return () => clearTimeout(timeoutId)
	// }, [controlsTimeout])

	return <OrbitControls enabled={true} {...rest} />
}

export default SceneControls
