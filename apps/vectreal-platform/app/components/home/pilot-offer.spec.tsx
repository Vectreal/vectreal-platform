// @vitest-environment jsdom
/**
 * Below `lg` one pinned drawing stands for all three terms, so it has to show
 * the stage of the term being read, and the terms it has passed must not show
 * around it.
 */
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PilotOffer } from './pilot-offer'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

type Box = { top: number; height: number; left: number; right: number }

let frames: FrameRequestCallback[] = []

beforeEach(() => {
	frames = []
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		frames.push(callback)
		return frames.length
	})
	vi.stubGlobal('cancelAnimationFrame', () => {})
	// Everything below the screen until a test places it.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		top: 5000,
		bottom: 5000,
		height: 0,
		left: 0,
		right: 0
	} as DOMRect)
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const renderOffer = () =>
	render(
		<MemoryRouter>
			<PilotOffer />
		</MemoryRouter>
	)

const frame = (container: HTMLElement) =>
	container.querySelector('[data-stage]') as HTMLElement

const term = (i: number) =>
	screen.getByRole('heading', { name: HOME_PAGE_COPY.pilot.blocks[i].title })
		.parentElement as HTMLElement

const put = (element: HTMLElement, { top, height, left, right }: Box) => {
	element.getBoundingClientRect = () =>
		({ top, bottom: top + height, height, left, right }) as DOMRect
}

/** An upright phone: the frame pinned above the terms, bottom edge at 282. */
const pinAbove = (container: HTMLElement) =>
	put(frame(container), { top: 68, height: 214, left: 16, right: 359 })

const tops = (
	values: number[],
	left: number,
	right: number,
	heights = [180, 180, 180]
) =>
	values.forEach((top, i) =>
		put(term(i), { top, height: heights[i], left, right })
	)

const placeTerms = (values: number[], left = 16, right = 359) =>
	tops(values, left, right)

/** Fires `type` on the window, then runs the frame it scheduled. */
const fire = (type: 'scroll' | 'resize') =>
	act(() => {
		window.dispatchEvent(new Event(type))
		for (const frame of frames.splice(0)) frame(0)
	})

const scroll = () => fire('scroll')

describe('the pinned stage', () => {
	it('starts on the first term, as the server renders it', () => {
		const { container } = renderOffer()
		expect(frame(container).dataset.stage).toBe('0')
	})

	it('shows the drawing of the last term past the line under the frame', () => {
		const { container } = renderOffer()
		pinAbove(container)
		// The line is 64px under the frame's bottom edge, at 346.
		placeTerms([-100, 330, 560])
		scroll()
		expect(frame(container).dataset.stage).toBe('1')

		const layers = [...frame(container).querySelectorAll('.absolute')]
		expect(
			layers.map((layer) => layer.classList.contains('opacity-100'))
		).toEqual([false, true, false])
	})

	/*
	  The terms scroll up under the frame, and anything of them above its bottom
	  edge showed in the gap under the nav and at the frame's rounded corners.
	*/
	it('clips each term at the frame bottom edge as it goes under', () => {
		const { container } = renderOffer()
		pinAbove(container)
		placeTerms([-100, 222, 560])
		scroll()
		expect(term(0).style.clipPath).toBe('inset(382px 0 0 0)')
		expect(term(1).style.clipPath).toBe('inset(60px 0 0 0)')
		expect(term(2).style.clipPath).toBe('')
	})

	/*
	  A jump can land with no term on the line and nothing crossing it, so the
	  stage is read off the page on every scroll frame.
	*/
	it('lands on the right stage after a jump', () => {
		const { container } = renderOffer()
		pinAbove(container)
		placeTerms([-900, -600, 330])
		scroll()
		expect(frame(container).dataset.stage).toBe('2')

		placeTerms([400, 630, 860])
		scroll()
		expect(frame(container).dataset.stage).toBe('0')
	})

	/*
	  From `sm` the frame sits beside the terms. It pins level with the first
	  term's top and lets go level with the last term's bottom, and the stages
	  split that travel in thirds, whatever the terms' heights: every rule read
	  off the heights got one end wrong for some wrap of the copy.
	*/
	const beside = (frameTop: number) => {
		const { container } = renderOffer()
		// Terms from 100 to 603; the frame, 282 tall, travels 221 between them.
		tops([100, 287, 515], 500, 950, [139, 180, 88])
		put(frame(container), { top: frameTop, height: 282, left: 24, right: 470 })
		scroll()
		return frame(container).dataset.stage
	}

	it('starts on the first term as the frame pins beside it', () => {
		expect(beside(100)).toBe('0')
	})

	it('moves on a third of the way through the frame travel', () => {
		expect(beside(100 + 221 * 0.4)).toBe('1')
	})

	it('ends on a short last term as the frame lets go', () => {
		expect(beside(603 - 282)).toBe('2')
	})

	it('clips nothing beside the terms', () => {
		beside(300)
		expect(term(0).style.clipPath).toBe('')
		expect(term(1).style.clipPath).toBe('')
	})

	/*
	  A reload or a back navigation can restore a scroll position inside the
	  section, with no scroll event after it.
	*/
	it('reads the page on mount, before any scroll', () => {
		vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(
			function (this: HTMLElement) {
				if (this.hasAttribute('data-stage')) {
					return {
						top: 68,
						bottom: 282,
						height: 214,
						left: 16,
						right: 359
					} as DOMRect
				}
				const title = this.querySelector(':scope > h3')?.textContent
				const i = HOME_PAGE_COPY.pilot.blocks.findIndex(
					(block) => block.title === title
				)
				const top = [-400, 100, 330][i] ?? 5000
				return {
					top,
					bottom: top + 180,
					height: 180,
					left: 16,
					right: 359
				} as DOMRect
			}
		)
		const { container } = renderOffer()
		expect(frame(container).dataset.stage).toBe('2')
		expect(term(1).style.clipPath).toBe('inset(182px 0 0 0)')
	})

	it('clears its clips once the frame is hidden, from `lg`', () => {
		const { container } = renderOffer()
		pinAbove(container)
		placeTerms([-100, 222, 560])
		scroll()
		expect(term(1).style.clipPath).not.toBe('')

		put(frame(container), { top: 0, height: 0, left: 0, right: 0 })
		fire('resize')
		expect(term(0).style.clipPath).toBe('')
		expect(term(1).style.clipPath).toBe('')
	})
})
