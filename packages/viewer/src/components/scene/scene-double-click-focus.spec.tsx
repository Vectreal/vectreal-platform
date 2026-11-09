// @vitest-environment jsdom
/**
 * A double-click or double-tap on the model focuses the spot under it, on the
 * background frames the view again, and does nothing while the controls are
 * off or on anything but the canvas.
 */
import { render } from '@testing-library/react'
import {
	BoxGeometry,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	Raycaster
} from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneDoubleClickFocus from './scene-double-click-focus'

const state = vi.hoisted(() => ({
	canvas: null as unknown as HTMLCanvasElement,
	camera: null as unknown,
	raycaster: null as unknown,
	controls: { enabled: true, enablePan: true }
}))

vi.mock('@react-three/fiber', () => ({
	useThree: (select: (value: unknown) => unknown) =>
		select({
			gl: { domElement: state.canvas },
			camera: state.camera,
			raycaster: state.raycaster,
			controls: state.controls
		})
}))

const SIZE = 200
const model = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
model.updateMatrixWorld()

beforeEach(() => {
	state.canvas = document.createElement('canvas')
	state.canvas.getBoundingClientRect = () =>
		({ left: 0, top: 0, width: SIZE, height: SIZE }) as DOMRect
	document.body.replaceChildren(state.canvas)
	const camera = new PerspectiveCamera(50, 1, 0.1, 100)
	camera.position.set(0, 0, 5)
	camera.lookAt(0, 0, 0)
	camera.updateMatrixWorld()
	state.camera = camera
	state.raycaster = new Raycaster()
	state.controls = { enabled: true, enablePan: true }
})

const mount = () => {
	const onFocus = vi.fn()
	const onBackground = vi.fn()
	render(
		<SceneDoubleClickFocus
			model={model}
			onFocus={onFocus}
			onBackground={onBackground}
		/>
	)
	return { onFocus, onBackground }
}

const CENTER = { clientX: SIZE / 2, clientY: SIZE / 2 }
const CORNER = { clientX: 5, clientY: 5 }

const doubleClick = (target: EventTarget, at = CENTER) =>
	target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, ...at }))

const pointer = (
	type: 'pointerdown' | 'pointerup',
	pointerType: string,
	at = CENTER,
	{ pointerId = 1, timeStamp }: { pointerId?: number; timeStamp?: number } = {}
) => {
	const event = new MouseEvent(type, { bubbles: true, ...at })
	Object.defineProperty(event, 'pointerType', { value: pointerType })
	Object.defineProperty(event, 'pointerId', { value: pointerId })
	if (timeStamp !== undefined)
		Object.defineProperty(event, 'timeStamp', { value: timeStamp })
	state.canvas.dispatchEvent(event)
}

const touchTap = (at = CENTER) => {
	pointer('pointerdown', 'touch', at)
	pointer('pointerup', 'touch', at)
}

describe('SceneDoubleClickFocus', () => {
	it('focuses the spot on the model under a double-click', () => {
		const { onFocus, onBackground } = mount()
		pointer('pointerdown', 'mouse')
		doubleClick(state.canvas)
		expect(onFocus).toHaveBeenCalledOnce()
		expect(onFocus.mock.calls[0][0].z).toBeCloseTo(0.5)
		expect(onBackground).not.toHaveBeenCalled()
	})

	it('frames the view again on a double-click on the background', () => {
		const { onFocus, onBackground } = mount()
		doubleClick(state.canvas, CORNER)
		expect(onBackground).toHaveBeenCalledOnce()
		expect(onFocus).not.toHaveBeenCalled()
	})

	it('does nothing while the controls are off', () => {
		state.controls = { enabled: false, enablePan: true }
		const { onFocus, onBackground } = mount()
		doubleClick(state.canvas)
		touchTap()
		touchTap()
		expect(onFocus).not.toHaveBeenCalled()
		expect(onBackground).not.toHaveBeenCalled()
	})

	it('leaves a double-click on something over the canvas, a hotspot marker, alone', () => {
		const marker = document.createElement('button')
		document.body.append(marker)
		const { onFocus, onBackground } = mount()
		doubleClick(marker)
		expect(onFocus).not.toHaveBeenCalled()
		expect(onBackground).not.toHaveBeenCalled()
	})

	it('focuses on a touch double-tap, once even if the browser also sends dblclick', () => {
		const { onFocus } = mount()
		touchTap()
		touchTap()
		doubleClick(state.canvas)
		expect(onFocus).toHaveBeenCalledOnce()
	})

	it('takes no single tap, and no drag, for a double-tap', () => {
		const { onFocus } = mount()
		touchTap()
		expect(onFocus).not.toHaveBeenCalled()
		// A drag that ends where the next tap lands is not its first half.
		pointer('pointerdown', 'touch', { clientX: 40, clientY: 100 })
		pointer('pointerup', 'touch')
		touchTap()
		expect(onFocus).not.toHaveBeenCalled()
	})

	it('takes no pinch for a double-tap', () => {
		const { onFocus } = mount()
		// Two fingers down; each lifts where it landed, close together.
		pointer('pointerdown', 'touch', CENTER, { pointerId: 1 })
		pointer('pointerdown', 'touch', CENTER, { pointerId: 2 })
		pointer('pointerup', 'touch', CENTER, { pointerId: 1 })
		pointer('pointerup', 'touch', CENTER, { pointerId: 2 })
		touchTap()
		expect(onFocus).not.toHaveBeenCalled()
	})

	it('takes no long press for the first tap', () => {
		const { onFocus } = mount()
		pointer('pointerdown', 'touch', CENTER, { timeStamp: 0 })
		pointer('pointerup', 'touch', CENTER, { timeStamp: 900 })
		pointer('pointerdown', 'touch', CENTER, { timeStamp: 950 })
		pointer('pointerup', 'touch', CENTER, { timeStamp: 1000 })
		expect(onFocus).not.toHaveBeenCalled()
	})

	it('keeps a fixed pivot where panning is off, and still frames on the background', () => {
		state.controls = { enabled: true, enablePan: false }
		const { onFocus, onBackground } = mount()
		doubleClick(state.canvas)
		expect(onFocus).not.toHaveBeenCalled()
		doubleClick(state.canvas, CORNER)
		expect(onBackground).toHaveBeenCalledOnce()
	})
})
