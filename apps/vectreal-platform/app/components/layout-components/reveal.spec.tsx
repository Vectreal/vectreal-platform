// @vitest-environment jsdom
/**
 * A section below the fold is hidden until it arrives, so every way of
 * arriving has to end with it shown. Jumping past it in one scroll, by an
 * anchor or a fling, never crosses the viewport: the old reveal waited for a
 * crossing that never came and left the section blank above the reader.
 */
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Reveal } from './reveal'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

let deliver: Callback = () => {}
let observerOptions: IntersectionObserverInit | undefined
let reduceMotion = false

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
		<Reveal>
			<h2 data-reveal>Heading</h2>
			<p data-reveal>Body</p>
		</Reveal>
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
			expect(el.style.opacity).toBe('0')
		}
	})

	// Server-rendered content already on screen must never flash out and back.
	it('hides nothing already on screen when the page hydrates', () => {
		vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
			top: 100,
			bottom: 500
		} as DOMRect)

		for (const el of renderSection()) {
			expect(el.style.opacity).toBe('')
			expect(el.style.transform).toBe('')
		}
	})

	it('hides nothing under reduced motion', () => {
		reduceMotion = true

		for (const el of renderSection()) {
			expect(el.style.opacity).toBe('')
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
			expect(el.style.opacity).toBe('')
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

	it('fades each block up in document order, one stagger apart', () => {
		const blocks = renderSection()
		arrive()

		const calls = vi.mocked(HTMLElement.prototype.animate).mock.calls
		expect(calls).toHaveLength(blocks.length)
		const delays = calls.map(
			([, options]) => (options as KeyframeAnimationOptions).delay
		)
		expect(delays[0]).toBe(0)
		expect(delays[1]).toBeGreaterThan(0)
		for (const [keyframes] of calls) {
			const frames = keyframes as Keyframe[]
			expect(frames[0]?.opacity).toBe(0)
			expect(frames.at(-1)?.opacity).toBe(1)
		}
	})

	it('is shown at once when motion was turned off after the page loaded', () => {
		const blocks = renderSection()
		reduceMotion = true
		arrive()

		for (const el of blocks) {
			expect(el.style.opacity).toBe('')
			expect(el.style.transform).toBe('')
		}
		expect(HTMLElement.prototype.animate).not.toHaveBeenCalled()
	})

	// A printed page is never scrolled, so nothing below the fold ever arrives.
	it('is shown when the page is printed before it arrived', () => {
		const blocks = renderSection()

		act(() => {
			window.dispatchEvent(new Event('beforeprint'))
		})

		for (const el of blocks) {
			expect(el.style.opacity).toBe('')
			expect(el.style.transform).toBe('')
		}
	})

	it('is shown, not caught mid-fade, when the page is printed mid-arrival', () => {
		const blocks = renderSection()
		arrive()

		act(() => {
			window.dispatchEvent(new Event('beforeprint'))
		})
		for (const el of blocks) expect(el.style.opacity).toBe('')
		for (const { value } of vi.mocked(HTMLElement.prototype.animate).mock
			.results) {
			expect((value as Animation).cancel).toHaveBeenCalled()
		}
	})

	it('leaves nothing hidden or running when it unmounts mid-arrival', () => {
		const blocks = renderSection()
		arrive()

		blocks.unmount()

		for (const el of blocks) {
			expect(el.style.opacity).toBe('')
			expect(el.style.transform).toBe('')
		}
		for (const { value } of vi.mocked(HTMLElement.prototype.animate).mock
			.results) {
			expect((value as Animation).cancel).toHaveBeenCalled()
		}
	})
})
