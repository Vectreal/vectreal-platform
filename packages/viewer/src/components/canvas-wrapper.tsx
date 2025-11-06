import { Canvas, CanvasProps } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'

interface CanvasWrapperProps extends CanvasProps {
	children: React.ReactNode
}

/**
 * A wrapper around react-three/fiber Canvas that handles StrictMode double-mounting
 * and WebGL context loss more gracefully.
 */
export const CanvasWrapper = ({ children, ...props }: CanvasWrapperProps) => {
	const [isReady, setIsReady] = useState(false)
	const mountedRef = useRef(false)

	useEffect(() => {
		// In StrictMode, this effect runs twice
		// We only want to mark as ready on the final mount
		const timer = setTimeout(() => {
			if (!mountedRef.current) {
				mountedRef.current = true
				setIsReady(true)
			}
		}, 0)

		return () => {
			clearTimeout(timer)
		}
	}, [])

	if (!isReady) {
		return null
	}

	return <Canvas {...props}>{children}</Canvas>
}
