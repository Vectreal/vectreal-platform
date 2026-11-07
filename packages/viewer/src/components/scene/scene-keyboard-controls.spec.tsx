// @vitest-environment jsdom
/**
 * The viewer's keys are heard on the viewer itself and nowhere else: not on a
 * control inside it, not on the host page, and not while the controls are off.
 * A key it takes never scrolls the page and never moves focus.
 */
import { render } from '@testing-library/react'
import { PerspectiveCamera, Vector3 } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneKeyboardControls from './scene-keyboard-controls'

import type { ViewerKeys } from './viewer-keys'

const state = vi.hoisted(() => ({ controls: null as unknown }))

vi.mock('@react-three/fiber', () => ({
	useThree: (select: (value: unknown) => unknown) =>
		select({ controls: state.controls })
}))

const ALL: ViewerKeys = { rotate: true, zoom: true, pan: true, home: true }

let azimuth: number
let container: HTMLDivElement
let inner: HTMLButtonElement

beforeEach(() => {
	azimuth = 0
	state.controls = {
		enabled: true,
		object: new PerspectiveCamera(),
		target: new Vector3(),
		getDistance: () => 1,
		getAzimuthalAngle: () => azimuth,
		setAzimuthalAngle: (value: number) => (azimuth = value),
		getPolarAngle: () => 1,
		setPolarAngle: vi.fn(),
		dollyIn: vi.fn(),
		dollyOut: vi.fn(),
		update: vi.fn()
	}
	document.body.replaceChildren()
	container = document.createElement('div')
	container.tabIndex = 0
	inner = document.createElement('button')
	container.append(inner)
	document.body.append(container)
})

const keydown = (target: EventTarget, key: string) => {
	const event = new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true
	})
	target.dispatchEvent(event)
	return event
}

const mount = (keys = ALL, onHome = vi.fn()) =>
	render(
		<SceneKeyboardControls container={container} keys={keys} onHome={onHome} />
	)

describe('SceneKeyboardControls', () => {
	it('turns the camera for a key pressed on the focused viewer, and keeps it from the page', () => {
		mount()
		container.focus()
		const event = keydown(container, 'ArrowRight')
		expect(azimuth).toBeGreaterThan(0)
		expect(event.defaultPrevented).toBe(true)
		expect(document.activeElement).toBe(container)
	})

	it('sends Home to the viewer', () => {
		const onHome = vi.fn()
		mount(ALL, onHome)
		keydown(container, 'Home')
		expect(onHome).toHaveBeenCalledOnce()
	})

	it('leaves a key pressed on a control inside the viewer to that control', () => {
		mount()
		const event = keydown(inner, 'ArrowRight')
		expect(azimuth).toBe(0)
		expect(event.defaultPrevented).toBe(false)
	})

	it('never hears the host page', () => {
		mount()
		const event = keydown(document.body, 'ArrowRight')
		expect(azimuth).toBe(0)
		expect(event.defaultPrevented).toBe(false)
	})

	it('takes no key while the controls are off, and lets the page scroll', () => {
		mount({ rotate: false, zoom: false, pan: false, home: false })
		const event = keydown(container, 'ArrowRight')
		expect(azimuth).toBe(0)
		expect(event.defaultPrevented).toBe(false)
	})

	it('moves nothing while the controls themselves are off', () => {
		;(state.controls as { enabled: boolean }).enabled = false
		mount()
		keydown(container, 'ArrowRight')
		expect(azimuth).toBe(0)
	})

	it('lets a key through whose action is switched off', () => {
		mount({ ...ALL, rotate: false })
		const event = keydown(container, 'ArrowRight')
		expect(azimuth).toBe(0)
		expect(event.defaultPrevented).toBe(false)
	})

	it('stops listening once unmounted', () => {
		const { unmount } = mount()
		unmount()
		keydown(container, 'ArrowRight')
		expect(azimuth).toBe(0)
	})
})
