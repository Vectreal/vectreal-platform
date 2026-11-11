import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/**
 * Copies the frame on screen into a 2D canvas, once, then reports it.
 *
 * Mounted only while the viewer is on its way out. Its priority above the
 * composer's makes the composer present its converged image this frame, so
 * the copy is taken from a buffer that holds one, not from a cleared buffer a
 * browser hands out after presenting. Without a composer this subscriber is
 * the only one with a priority, which stops R3F's own render, so it draws.
 *
 * Taken at the viewer's CSS size: it stands in for a moment, and a copy at
 * the drawing buffer's ratio would cost up to four times the memory.
 */
export const LastFrameCapture = ({
	onCapture
}: {
	onCapture: (frame: HTMLCanvasElement | null) => void
}) => {
	const done = useRef(false)
	useFrame(({ gl, scene, camera, internal }) => {
		if (done.current) return
		done.current = true
		if (internal.priority === 1) gl.render(scene, camera)
		const source = gl.domElement
		const frame = document.createElement('canvas')
		frame.width = source.clientWidth
		frame.height = source.clientHeight
		const context = frame.getContext('2d')
		if (!context || !frame.width || !frame.height) return onCapture(null)
		context.drawImage(source, 0, 0, frame.width, frame.height)
		onCapture(frame)
	}, 2)
	return null
}

/**
 * Reports once the canvas it sits in has drawn to the screen, a frame after
 * that draw, so the frame has been presented. Draws into render targets, such
 * as an environment map or the shadow bake, do not count.
 */
export const FirstFrameWatch = ({ onDrawn }: { onDrawn: () => void }) => {
	const gl = useThree((state) => state.gl)
	const drawn = useRef(false)
	const done = useRef(false)
	useEffect(() => {
		const render = gl.render
		gl.render = function (...args: Parameters<typeof render>) {
			render.apply(this, args)
			if (gl.getRenderTarget() === null) drawn.current = true
		}
		return () => {
			gl.render = render
		}
	}, [gl])
	useFrame(() => {
		if (done.current || !drawn.current) return
		done.current = true
		onDrawn()
	})
	return null
}

/** Shows a copied frame, covering the viewer, until the canvas draws again. */
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
			className="vv:pointer-events-none vv:absolute vv:inset-0 vv:[&>canvas]:h-full vv:[&>canvas]:w-full vv:[&>canvas]:object-cover"
		/>
	)
}
