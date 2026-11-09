import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector2, type Object3D, type Vector3 } from 'three'

import { isDoubleTap, isTap, type Tap } from './double-tap'

import type { OrbitControlsInstance } from './viewer-keys'

interface SceneDoubleClickFocusProps {
	/** The model drawn, the only thing a double-click can focus on. */
	model: Object3D
	/** A point on the model was double-clicked. */
	onFocus: (point: Vector3) => void
	/** The background was double-clicked. */
	onBackground: () => void
}

const pointer = new Vector2()

/**
 * Double-click, or double-tap, to focus: on the model the orbit point moves to
 * the spot under the pointer; on the background the view is framed again.
 *
 * Heard on the canvas only, so a hotspot marker, drawn as HTML over it, keeps
 * its own clicks. Nothing happens while the controls are off: a host driving
 * the camera itself keeps it. With panning off the scene's pivot is fixed, so
 * the model is not focused; the background still frames the view again.
 */
const SceneDoubleClickFocus = ({
	model,
	onFocus,
	onBackground
}: SceneDoubleClickFocusProps) => {
	const canvas = useThree((state) => state.gl.domElement)
	const camera = useThree((state) => state.camera)
	const raycaster = useThree((state) => state.raycaster)
	const controls = useThree(
		(state) => state.controls
	) as OrbitControlsInstance | null

	useEffect(() => {
		const focusAt = (clientX: number, clientY: number) => {
			if (!controls?.enabled) return
			const rect = canvas.getBoundingClientRect()
			pointer.set(
				((clientX - rect.left) / rect.width) * 2 - 1,
				-((clientY - rect.top) / rect.height) * 2 + 1
			)
			raycaster.setFromCamera(pointer, camera)
			const hit = raycaster.intersectObject(model, true)[0]
			if (!hit) onBackground()
			else if (controls.enablePan) onFocus(hit.point)
		}

		let lastPointerType = ''
		let down: Tap | null = null
		let lastTap: Tap | null = null
		// A second finger makes the gesture a pinch or a two-finger pan, and
		// nothing lifted before every finger is off can be a tap.
		const touches = new Set<number>()
		let multiTouch = false

		const handlePointerDown = (event: PointerEvent) => {
			lastPointerType = event.pointerType
			if (event.pointerType === 'touch') {
				touches.add(event.pointerId)
				if (touches.size > 1) multiTouch = true
			}
			down = { time: event.timeStamp, x: event.clientX, y: event.clientY }
		}
		const handlePointerUp = (event: PointerEvent) => {
			if (event.pointerType !== 'touch') return
			touches.delete(event.pointerId)
			if (multiTouch) {
				lastTap = null
				if (touches.size === 0) multiTouch = false
				return
			}
			if (!down) return
			const tap = { time: event.timeStamp, x: event.clientX, y: event.clientY }
			if (!isTap(down, tap)) {
				lastTap = null
				return
			}
			if (isDoubleTap(lastTap, tap)) {
				lastTap = null
				focusAt(tap.x, tap.y)
			} else {
				lastTap = tap
			}
		}
		// A touch double-tap is handled above; a browser that also sends
		// `dblclick` for it would focus twice.
		const handleDoubleClick = (event: MouseEvent) => {
			if (lastPointerType === 'touch') return
			focusAt(event.clientX, event.clientY)
		}

		canvas.addEventListener('pointerdown', handlePointerDown)
		canvas.addEventListener('pointerup', handlePointerUp)
		canvas.addEventListener('pointercancel', handlePointerUp)
		canvas.addEventListener('dblclick', handleDoubleClick)
		return () => {
			canvas.removeEventListener('pointerdown', handlePointerDown)
			canvas.removeEventListener('pointerup', handlePointerUp)
			canvas.removeEventListener('pointercancel', handlePointerUp)
			canvas.removeEventListener('dblclick', handleDoubleClick)
		}
	}, [camera, canvas, controls, model, onBackground, onFocus, raycaster])

	return null
}

export default SceneDoubleClickFocus
