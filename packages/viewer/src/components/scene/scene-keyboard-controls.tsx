import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

import {
	applyViewerKey,
	type OrbitControlsInstance,
	type ViewerKeys
} from './viewer-keys'

interface SceneKeyboardControlsProps {
	/** The viewer's own element, the one that takes focus. */
	container: HTMLElement | null
	keys: ViewerKeys
	onHome: () => void
}

/**
 * Orbits, pans and zooms the camera from the keyboard, through the same
 * controls a pointer drives.
 *
 * Heard only while the viewer itself has focus: a key pressed on a hotspot or
 * the camera list inside it is theirs, and one pressed anywhere on the host
 * page never reaches this listener.
 *
 * Nothing moves while the controls themselves are off, `controlsTimeout`
 * included: they apply a damped turn only while enabled, so a turn made
 * before would land all at once when they come on.
 */
const SceneKeyboardControls = ({
	container,
	keys,
	onHome
}: SceneKeyboardControlsProps) => {
	const controls = useThree(
		(state) => state.controls
	) as OrbitControlsInstance | null

	useEffect(() => {
		if (!container || !controls) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.target !== container ||
				event.defaultPrevented ||
				!controls.enabled
			)
				return
			if (applyViewerKey(event, controls, keys, onHome)) event.preventDefault()
		}

		container.addEventListener('keydown', handleKeyDown)
		return () => container.removeEventListener('keydown', handleKeyDown)
	}, [container, controls, keys, onHome])

	return null
}

export default SceneKeyboardControls
