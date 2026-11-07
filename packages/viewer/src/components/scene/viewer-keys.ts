import { Vector3 } from 'three'

import type { OrbitControls } from '@react-three/drei'
import type { ControlsProps } from '@vctrl/core'
import type { ComponentRef } from 'react'

/** The keys the viewer answers while it has focus, by what they do. */
export interface ViewerKeys {
	rotate: boolean
	zoom: boolean
	pan: boolean
	home: boolean
}

/** A turn per arrow press: small enough to aim, large enough to see. */
export const ROTATE_STEP = Math.PI / 24
/** Each press moves the camera this much closer, or as much further away. */
export const ZOOM_STEP = 0.85
/** A pan per arrow press, as a share of the distance to what the camera orbits. */
export const PAN_STEP = 0.05

export type OrbitControlsInstance = ComponentRef<typeof OrbitControls>

type KeyControls = Pick<
	OrbitControlsInstance,
	| 'getAzimuthalAngle'
	| 'setAzimuthalAngle'
	| 'getPolarAngle'
	| 'setPolarAngle'
	| 'getDistance'
	| 'dollyIn'
	| 'dollyOut'
	| 'object'
	| 'target'
	| 'update'
>

type KeyPress = Pick<
	KeyboardEvent,
	'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'
>

/**
 * Which keys work, from the same flags the pointer obeys. Nothing works while
 * the controls are off, so a host driving the camera itself keeps it.
 */
export function resolveViewerKeys(
	controls: Pick<
		ControlsProps,
		'enabled' | 'enableRotate' | 'enableZoom' | 'enablePan'
	>,
	{ canReturnHome }: { canReturnHome: boolean }
): ViewerKeys {
	const enabled = controls.enabled !== false
	return {
		rotate: enabled && controls.enableRotate !== false,
		zoom: enabled && controls.enableZoom !== false,
		pan: enabled && controls.enablePan !== false,
		home: enabled && canReturnHome
	}
}

/** What a screen reader announces after the viewer's name. */
export function describeViewerKeys(keys: ViewerKeys): string {
	return [
		keys.rotate && 'Arrow keys rotate the view.',
		keys.pan && 'Shift and arrow keys pan.',
		keys.zoom && 'Plus and minus zoom.',
		keys.home && 'Home resets the view.'
	]
		.filter(Boolean)
		.join(' ')
}

/** Each arrow as a direction on screen: right and up are positive. */
const ARROWS: Record<string, readonly [number, number]> = {
	ArrowLeft: [-1, 0],
	ArrowRight: [1, 0],
	ArrowUp: [0, 1],
	ArrowDown: [0, -1]
}

const screenRight = new Vector3()
const screenUp = new Vector3()

/** Slides the camera, and what it orbits with it, across the screen. */
function pan(controls: KeyControls, x: number, y: number) {
	const step = controls.getDistance() * PAN_STEP
	const { matrix, position } = controls.object
	screenRight.setFromMatrixColumn(matrix, 0).multiplyScalar(x * step)
	screenUp.setFromMatrixColumn(matrix, 1).multiplyScalar(y * step)
	const offset = screenRight.add(screenUp)
	position.add(offset)
	controls.target.add(offset)
	controls.update()
}

/**
 * Moves the camera for one key press. Returns whether the key was the
 * viewer's, so the caller keeps it from scrolling the page; a key whose action
 * is switched off is left to the page.
 *
 * Ctrl, Cmd and Alt combinations belong to the browser: Cmd and plus zooms the
 * page, not the model.
 */
export function applyViewerKey(
	press: KeyPress,
	controls: KeyControls,
	keys: ViewerKeys,
	returnHome: () => void
): boolean {
	if (press.ctrlKey || press.metaKey || press.altKey) return false

	const arrow = ARROWS[press.key]
	if (arrow) {
		const [x, y] = arrow
		if (press.shiftKey) {
			if (!keys.pan) return false
			pan(controls, x, y)
			return true
		}
		if (!keys.rotate) return false
		// The camera goes the way the arrow points, as it does for a pan.
		if (x)
			controls.setAzimuthalAngle(controls.getAzimuthalAngle() + x * ROTATE_STEP)
		if (y) controls.setPolarAngle(controls.getPolarAngle() - y * ROTATE_STEP)
		return true
	}

	switch (press.key) {
		case '+':
		case '=':
			if (!keys.zoom) return false
			controls.dollyIn(ZOOM_STEP)
			return true
		case '-':
			if (!keys.zoom) return false
			controls.dollyOut(ZOOM_STEP)
			return true
		case 'Home':
			if (!keys.home) return false
			returnHome()
			return true
		default:
			return false
	}
}
