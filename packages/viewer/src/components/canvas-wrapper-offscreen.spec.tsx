// @vitest-environment jsdom
/**
 * Off-screen, an unloading viewer copies its last frame before the canvas
 * goes and shows that copy on return until the canvas draws again; a pausing
 * viewer keeps its canvas and stops drawing.
 */
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Canvas from './canvas-wrapper'

import type { ReactNode } from 'react'

const three = vi.hoisted(() => ({ frameloop: undefined as string | undefined }))
const frames = vi.hoisted(() => ({
	capture: undefined as undefined | ((frame: HTMLCanvasElement | null) => void),
	drawn: undefined as undefined | (() => void)
}))

vi.mock('@react-three/fiber', () => ({
	Canvas: ({
		children,
		frameloop
	}: {
		children: ReactNode
		frameloop?: string
	}) => {
		three.frameloop = frameloop
		return <div data-testid="webgl-canvas">{children}</div>
	}
}))
vi.mock('@react-three/drei', () => ({ PerformanceMonitor: () => null }))
vi.mock('./context-loss-listener', () => ({ default: () => null }))
vi.mock('./last-frame', () => ({
	LastFrameCapture: ({
		onCapture
	}: {
		onCapture: (frame: HTMLCanvasElement | null) => void
	}) => {
		frames.capture = onCapture
		return <span data-testid="capturing" />
	},
	FirstFrameWatch: ({ onDrawn }: { onDrawn: () => void }) => {
		frames.drawn = onDrawn
		return null
	},
	LastFrame: () => <span data-testid="last-frame" />
}))

const observers: IntersectionObserverCallback[] = []
/** Every observer hears the viewer at `ratio` of itself on screen. */
const intersect = (isIntersecting: boolean, ratio = isIntersecting ? 1 : 0) =>
	act(() =>
		observers.forEach((callback) =>
			callback(
				[
					{
						isIntersecting,
						intersectionRatio: ratio
					} as IntersectionObserverEntry
				],
				{} as IntersectionObserver
			)
		)
	)

beforeEach(() => {
	frames.capture = undefined
	frames.drawn = undefined
	observers.length = 0
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener: () => undefined,
		removeEventListener: () => undefined
	}))
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: IntersectionObserverCallback) {
				observers.push(callback)
			}
			observe() {}
			disconnect() {}
		}
	)
})

const viewer = (offscreen?: 'unload' | 'pause') =>
	render(
		<Canvas offscreen={offscreen} loadingState="ready">
			{null}
		</Canvas>
	)

const webgl = () => screen.queryByTestId('webgl-canvas')

describe('an unloading viewer off-screen', () => {
	it('copies its frame before the canvas goes, and shows the copy until the canvas draws again', () => {
		viewer()
		intersect(true)
		expect(webgl()).not.toBeNull()

		intersect(false)
		expect(screen.queryByTestId('capturing')).not.toBeNull()
		act(() => frames.capture?.(document.createElement('canvas')))
		expect(webgl()).toBeNull()
		expect(screen.queryByTestId('last-frame')).not.toBeNull()

		intersect(true)
		expect(webgl()).not.toBeNull()
		expect(screen.queryByTestId('last-frame')).not.toBeNull()
		act(() => frames.drawn?.())
		expect(screen.queryByTestId('last-frame')).toBeNull()
	})

	it('copies its frame while still half in view, where a cross-origin frame still draws', () => {
		viewer()
		intersect(true)
		intersect(true, 0.3)
		expect(screen.queryByTestId('capturing')).not.toBeNull()
		act(() => frames.capture?.(document.createElement('canvas')))
		expect(screen.queryByTestId('capturing')).toBeNull()

		intersect(false)
		expect(webgl()).toBeNull()
		expect(screen.queryByTestId('last-frame')).not.toBeNull()
	})

	it('keeps its copy when it leaves again before the new canvas has drawn', () => {
		viewer()
		intersect(true)
		intersect(true, 0.3)
		act(() => frames.capture?.(document.createElement('canvas')))
		intersect(false)

		intersect(true)
		intersect(true, 0.3)
		expect(screen.queryByTestId('capturing')).toBeNull()
		intersect(false)
		expect(screen.queryByTestId('last-frame')).not.toBeNull()
	})

	it('still lets the canvas go when no frame comes to copy', () => {
		vi.useFakeTimers()
		viewer()
		intersect(true)
		intersect(false)
		act(() => vi.advanceTimersByTime(600))
		expect(webgl()).toBeNull()
		vi.useRealTimers()
	})
})

describe('a pausing viewer off-screen', () => {
	it('keeps its canvas and stops drawing until it is back', () => {
		viewer('pause')
		intersect(true)
		expect(three.frameloop).not.toBe('never')

		intersect(false)
		expect(webgl()).not.toBeNull()
		expect(three.frameloop).toBe('never')
		expect(screen.queryByTestId('capturing')).toBeNull()

		intersect(true)
		expect(three.frameloop).not.toBe('never')
	})
})
