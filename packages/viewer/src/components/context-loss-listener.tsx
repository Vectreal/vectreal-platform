import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

interface ContextLossListenerProps {
	onContextLost: (event: Event) => void
	onContextRestored: () => void
	onUnmount: () => void
}

/**
 * Listens for the browser taking the canvas's WebGL context away and giving
 * it back.
 *
 * Mounted inside the canvas so the listeners live exactly as long as that
 * canvas does. React Fiber calls `forceContextLoss()` on a canvas it unmounts
 * (after a delay), which fires `webglcontextlost` on purpose; a listener that
 * outlived its canvas - one attached from outside, say - would read every
 * scroll out of view and every remount as a real loss.
 */
const ContextLossListener = ({
	onContextLost,
	onContextRestored,
	onUnmount
}: ContextLossListenerProps) => {
	const canvas = useThree((state) => state.gl.domElement)

	useEffect(() => {
		canvas.addEventListener('webglcontextlost', onContextLost)
		canvas.addEventListener('webglcontextrestored', onContextRestored)
		return () => {
			canvas.removeEventListener('webglcontextlost', onContextLost)
			canvas.removeEventListener('webglcontextrestored', onContextRestored)
		}
	}, [canvas, onContextLost, onContextRestored])

	useEffect(() => onUnmount, [onUnmount])

	return null
}

export default ContextLossListener
