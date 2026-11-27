// @vitest-environment jsdom
/**
 * When the editor view counts as moved off its camera: the camera changing
 * while the author's own input is under way, and nothing else.
 */
import { act, render } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { EventDispatcher, PerspectiveCamera } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	viewArrivedAtom,
	viewLensAtom,
	viewMovedAtom
} from '../../lib/stores/publisher-config-store'
import { EditorViewTracker } from './publisher-editor-scene'

const three = vi.hoisted(() => ({
	state: null as null | Record<string, unknown>
}))

vi.mock('@react-three/fiber', () => ({
	useThree: (select: (state: unknown) => unknown) => select(three.state)
}))
vi.mock('@react-three/drei', () => ({
	GizmoHelper: () => null,
	GizmoViewcube: () => null,
	TransformControls: () => null
}))

let camera: PerspectiveCamera
let controls: EventDispatcher<{ change: object }>
let canvas: HTMLCanvasElement
let viewerRoot: HTMLDivElement

beforeEach(() => {
	camera = new PerspectiveCamera(50, 16 / 9)
	controls = new EventDispatcher()
	document.body.innerHTML = ''
	viewerRoot = document.createElement('div')
	canvas = document.createElement('canvas')
	viewerRoot.append(canvas)
	document.body.append(viewerRoot)
	three.state = {
		camera,
		controls,
		gl: { domElement: canvas },
		invalidate: () => undefined
	}
})

const mount = () => {
	const store = createStore()
	render(
		<Provider store={store}>
			<EditorViewTracker />
		</Provider>
	)
	return store
}

const change = () => act(() => controls.dispatchEvent({ type: 'change' }))

describe('EditorViewTracker', () => {
	it('counts a drag that turns the camera', () => {
		const store = mount()
		canvas.dispatchEvent(new Event('pointerdown'))
		change()
		expect(store.get(viewMovedAtom)).toBe(true)
	})

	it('ignores a press that turns nothing, and the damping after it', () => {
		const store = mount()
		canvas.dispatchEvent(new Event('pointerdown'))
		window.dispatchEvent(new Event('pointerup'))
		change()
		expect(store.get(viewMovedAtom)).toBe(false)
	})

	it('ignores a camera change with no input under way, such as a flight', () => {
		const store = mount()
		change()
		expect(store.get(viewMovedAtom)).toBe(false)
	})

	const keyOn = (target: EventTarget) =>
		target.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
		)

	it('counts a key on the viewer moving the view', () => {
		const store = mount()
		keyOn(viewerRoot)
		change()
		expect(store.get(viewMovedAtom)).toBe(true)
	})

	it('ignores a key aimed elsewhere, such as Enter on a sidebar button', () => {
		const store = mount()
		const button = document.createElement('button')
		document.body.append(button)
		keyOn(button)
		change()
		expect(store.get(viewMovedAtom)).toBe(false)
	})

	it('does not count the flight to a camera a key sent the view to', () => {
		const store = mount()
		keyOn(viewerRoot)
		// Home: the viewer arrives at the opening camera, then flies there.
		act(() => store.set(viewArrivedAtom))
		change()
		expect(store.get(viewMovedAtom)).toBe(false)
	})

	it('counts the flight of a double-click focus', () => {
		const store = mount()
		canvas.dispatchEvent(new Event('dblclick'))
		change()
		expect(store.get(viewMovedAtom)).toBe(true)
	})

	it('counts a focus applied at once, under reduced motion', () => {
		const store = mount()
		// The viewer moves the camera inside its own dblclick listener.
		canvas.addEventListener('dblclick', () => change())
		canvas.dispatchEvent(new Event('dblclick'))
		expect(store.get(viewMovedAtom)).toBe(true)
	})

	it('does not count a double-click that sent the view home, whichever listener runs first', () => {
		// The viewer's listener, registered before the tracker's.
		let store: ReturnType<typeof mount> | null = null
		canvas.addEventListener('dblclick', () => store?.set(viewArrivedAtom))
		store = mount()
		canvas.dispatchEvent(new Event('dblclick'))
		change()
		expect(store.get(viewMovedAtom)).toBe(false)
	})

	it('counts the flight of a double-tap focus', () => {
		const store = mount()
		const touchUp = () =>
			canvas.dispatchEvent(
				Object.assign(new Event('pointerup', { bubbles: true }), {
					pointerType: 'touch'
				})
			)
		touchUp()
		touchUp()
		change()
		expect(store.get(viewMovedAtom)).toBe(true)
	})

	it('ignores a key pressed on the page itself', () => {
		const store = mount()
		keyOn(document.body)
		change()
		expect(store.get(viewMovedAtom)).toBe(false)
	})

	it('gives the camera the lens being tried out, and keeps it through a flight', () => {
		const store = mount()
		act(() => store.set(viewLensAtom, 30))
		expect(camera.fov).toBe(30)

		// A flight writes the lens it started with.
		camera.fov = 50
		change()
		expect(camera.fov).toBe(30)
	})
})
