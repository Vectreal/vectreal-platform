// @vitest-environment jsdom
/**
 * A section below the fold is hidden until it arrives, so every way of
 * arriving has to end with it shown. Jumping past it in one scroll, by an
 * anchor or a fling, never crosses the viewport: the old reveal waited for a
 * crossing that never came and left the section blank above the reader.
 */
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DitherReveal } from './dither-reveal'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

let deliver: Callback = () => {}
let observerOptions: IntersectionObserverInit | undefined
let reduceMotion = false

// Frames run only when a test flushes them, at the time it names.
let pending = new Map<number, FrameRequestCallback>()
let nextFrame = 0
let now = 0
function flushFrames(t: number) {
	now = t
	const queue = [...pending.values()]
	pending = new Map()
	for (const callback of queue) callback(t)
}

beforeEach(() => {
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: Callback, options?: IntersectionObserverInit) {
				deliver = callback
				observerOptions = options
			}
			observe() {}
			disconnect() {}
		}
	)
	reduceMotion = false
	vi.stubGlobal('matchMedia', () => ({ matches: reduceMotion }))
	pending = new Map()
	now = 0
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		pending.set(++nextFrame, callback)
		return nextFrame
	})
	vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id))
	vi.spyOn(performance, 'now').mockImplementation(() => now)
	// The section starts below the fold.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		top: 5000,
		bottom: 5400
	} as DOMRect)
	HTMLElement.prototype.animate = vi.fn(() => ({
		finished: new Promise(() => {}),
		cancel: vi.fn()
	})) as unknown as HTMLElement['animate']
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

function renderSection() {
	const { getByText, unmount } = render(
		<DitherReveal>
			<h2 data-reveal>Heading</h2>
			<p data-reveal>Body</p>
		</DitherReveal>
	)
	return Object.assign([getByText('Heading'), getByText('Body')], { unmount })
}

function arrive(bottom = 400) {
	act(() =>
		deliver([
			{
				isIntersecting: true,
				boundingClientRect: { bottom } as DOMRect
			}
		])
	)
}

describe('a section revealed on arrival', () => {
	it('starts hidden below the fold', () => {
		for (const el of renderSection()) {
			expect(el.style.maskImage).not.toBe('')
		}
	})

	// Server-rendered content already on screen must never flash out and back.
	it('hides nothing already on screen when the page hydrates', () => {
		vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
			top: 100,
			bottom: 500
		} as DOMRect)

		for (const el of renderSection()) {
			expect(el.style.maskImage).toBe('')
			expect(el.style.transform).toBe('')
		}
	})

	it('hides nothing under reduced motion', () => {
		reduceMotion = true

		for (const el of renderSection()) {
			expect(el.style.maskImage).toBe('')
			expect(el.style.transform).toBe('')
		}
	})

	/*
	  The stub observer fires whenever a test says so, so this half pins what
	  makes a real one fire for a section above the viewport: a top margin
	  reaching far past any page.
	*/
	it('watches the whole page above the viewport', () => {
		renderSection()
		const top = Number.parseFloat(observerOptions?.rootMargin ?? '0')
		expect(top).toBeGreaterThan(10_000)
	})

	it('is shown at once when it was jumped past', () => {
		const blocks = renderSection()

		arrive(-200)

		for (const el of blocks) {
			expect(el.style.maskImage).toBe('')
			expect(el.style.transform).toBe('')
		}
		expect(HTMLElement.prototype.animate).not.toHaveBeenCalled()
	})

	it('hands each block from its inline offset to an animation ending in place', async () => {
		let settle = () => {}
		const finished = new Promise<void>((resolve) => (settle = resolve))
		const cancel = vi.fn()
		vi.mocked(HTMLElement.prototype.animate).mockImplementation(
			() => ({ finished, cancel }) as unknown as Animation
		)
		const blocks = renderSection()
		arrive()

		const calls = vi.mocked(HTMLElement.prototype.animate).mock.calls
		expect(calls).toHaveLength(blocks.length)
		for (const [keyframes] of calls) {
			const frames = keyframes as Keyframe[]
			expect(frames.at(-1)?.transform).toBe('translateY(0)')
		}
		// The inline offset has to go, or the block sits low once the animation ends.
		for (const el of blocks) expect(el.style.transform).toBe('')

		settle()
		await finished
		await Promise.resolve()
		expect(cancel).toHaveBeenCalledTimes(blocks.length)
	})

	it('resolves from the grain to solid as each block seats', () => {
		const [heading, body] = renderSection()
		const hidden = heading.style.maskImage
		arrive()

		// Part way: some grain, neither hidden nor solid.
		flushFrames(100)
		expect(heading.style.maskImage).not.toBe('')
		expect(heading.style.maskImage).not.toBe(hidden)

		// The heading has seated; the body, one stagger behind, has not yet.
		flushFrames(360)
		expect(heading.style.maskImage).toBe('')
		expect(body.style.maskImage).not.toBe('')

		flushFrames(430)
		expect(body.style.maskImage).toBe('')
		expect(pending.size).toBe(0)
	})

	it('is shown at once when motion was turned off after the page loaded', () => {
		const blocks = renderSection()
		reduceMotion = true
		arrive()

		for (const el of blocks) {
			expect(el.style.maskImage).toBe('')
			expect(el.style.transform).toBe('')
		}
		expect(HTMLElement.prototype.animate).not.toHaveBeenCalled()
	})

	it('leaves nothing hidden or running when it unmounts mid-arrival', () => {
		const blocks = renderSection()
		arrive()
		flushFrames(100)

		blocks.unmount()
		expect(pending.size).toBe(0)
		flushFrames(200)

		for (const el of blocks) {
			expect(el.style.maskImage).toBe('')
			expect(el.style.transform).toBe('')
		}
		for (const { value } of vi.mocked(HTMLElement.prototype.animate).mock
			.results) {
			expect((value as Animation).cancel).toHaveBeenCalled()
		}
	})
})
