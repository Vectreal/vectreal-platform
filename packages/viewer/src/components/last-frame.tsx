import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/**
 * Copies the frame on screen into a 2D canvas, once, then reports it.
 *
 * Mounted only for the moment before the viewer unloads its canvas. Its
 * priority above the composer's makes the composer present its converged
 * image this frame, so the copy is taken from a buffer that holds one, not
 * from a cleared buffer a browser hands out after presenting.
 */
export const LastFrameCapture = ({
	onCapture
}: {
	onCapture: (frame: HTMLCanvasElement | null) => void
}) => {
	const done = useRef(false)
	useFrame(({ gl }) => {
		if (done.current) return
		done.current = true
		const source = gl.domElement
		const frame = document.createElement('canvas')
		frame.width = source.width
		frame.height = source.height
		const context = frame.getContext('2d')
		if (!context || !source.width || !source.height) return onCapture(null)
		context.drawImage(source, 0, 0)
		onCapture(frame)
	}, 2)
	return null
}

/**
 * Reports once the canvas it sits in has drawn: a frame callback that sees the
 * renderer's frame count above zero runs after that frame was presented.
 */
export const FirstFrameWatch = ({ onDrawn }: { onDrawn: () => void }) => {
	const gl = useThree((state) => state.gl)
	const done = useRef(false)
	useFrame(() => {
		if (done.current || gl.info.render.frame === 0) return
		done.current = true
		onDrawn()
	})
	return null
}

/** Shows a copied frame, filling the viewer, until the canvas draws again. */
export const LastFrame = ({ frame }: { frame: HTMLCanvasElement }) => {
	const holder = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const element = holder.current
		if (!element) return
		element.appendChild(frame)
		return () => {
			frame.remove()
		}
	}, [frame])
	return (
		<div
			ref={holder}
			aria-hidden
			className="vv:pointer-events-none vv:absolute vv:inset-0 vv:[&>canvas]:h-full vv:[&>canvas]:w-full"
		/>
	)
}
