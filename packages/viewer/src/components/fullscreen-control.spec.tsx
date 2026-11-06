// @vitest-environment jsdom
/**
 * The full screen button shows the viewer full screen and back, and draws
 * nothing where the browser will not allow it.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import FullscreenControl from './fullscreen-control'

let target: HTMLDivElement
let fullscreenElement: Element | null

beforeEach(() => {
	target = document.createElement('div')
	target.requestFullscreen = vi.fn(() => Promise.resolve())
	fullscreenElement = null
	Object.defineProperty(document, 'fullscreenElement', {
		configurable: true,
		get: () => fullscreenElement
	})
	Object.defineProperty(document, 'fullscreenEnabled', {
		configurable: true,
		value: true
	})
	document.exitFullscreen = vi.fn(() => Promise.resolve())
})

afterEach(() => {
	Reflect.deleteProperty(document, 'fullscreenElement')
	Reflect.deleteProperty(document, 'fullscreenEnabled')
})

const enterFullscreen = () =>
	act(() => {
		fullscreenElement = target
		document.dispatchEvent(new Event('fullscreenchange'))
	})

describe('FullscreenControl', () => {
	it('shows the viewer full screen', () => {
		render(<FullscreenControl target={target} />)
		fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
		expect(target.requestFullscreen).toHaveBeenCalledOnce()
	})

	it('leaves full screen from the same button once there', () => {
		render(<FullscreenControl target={target} />)
		enterFullscreen()
		fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }))
		expect(document.exitFullscreen).toHaveBeenCalledOnce()
		expect(target.requestFullscreen).not.toHaveBeenCalled()
	})

	it('reads another element in full screen as not this viewer', () => {
		render(<FullscreenControl target={target} />)
		act(() => {
			fullscreenElement = document.createElement('div')
			document.dispatchEvent(new Event('fullscreenchange'))
		})
		expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy()
	})

	it('draws nothing where the browser does not allow full screen', () => {
		Object.defineProperty(document, 'fullscreenEnabled', {
			configurable: true,
			value: false
		})
		const { container } = render(<FullscreenControl target={target} />)
		expect(container.childElementCount).toBe(0)
	})

	it('draws nothing where the element cannot go full screen, as on iPhone', () => {
		Reflect.deleteProperty(target, 'requestFullscreen')
		Object.defineProperty(target, 'requestFullscreen', { value: undefined })
		const { container } = render(<FullscreenControl target={target} />)
		expect(container.childElementCount).toBe(0)
	})
})
