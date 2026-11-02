// @vitest-environment jsdom
/**
 * The listener's lifetime is the canvas's. React Fiber fires
 * `webglcontextlost` itself on a canvas it unmounts, so a listener still
 * attached then would read a scroll out of view as a real loss.
 */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ContextLossListener from './context-loss-listener'

const canvas = document.createElement('canvas')

vi.mock('@react-three/fiber', () => ({
	useThree: (
		select: (state: { gl: { domElement: HTMLCanvasElement } }) => unknown
	) => select({ gl: { domElement: canvas } })
}))

function mount() {
	const handlers = {
		onContextLost: vi.fn(),
		onContextRestored: vi.fn(),
		onUnmount: vi.fn()
	}
	const view = render(<ContextLossListener {...handlers} />)
	return { ...handlers, unmount: view.unmount }
}

describe('ContextLossListener', () => {
	it('hears the canvas lose and regain its context while mounted', () => {
		const { onContextLost, onContextRestored, unmount } = mount()

		canvas.dispatchEvent(new Event('webglcontextlost'))
		canvas.dispatchEvent(new Event('webglcontextrestored'))

		expect(onContextLost).toHaveBeenCalledOnce()
		expect(onContextRestored).toHaveBeenCalledOnce()
		unmount()
	})

	it('stops listening when its canvas goes, and says it went', () => {
		const { onContextLost, onUnmount, unmount } = mount()

		unmount()
		canvas.dispatchEvent(new Event('webglcontextlost'))

		expect(onContextLost).not.toHaveBeenCalled()
		expect(onUnmount).toHaveBeenCalledOnce()
	})
})
