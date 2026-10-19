// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDocToc } from './use-doc-toc'

/*
  The observer's band has to start where an anchor jump lands a heading, or a
  heading just jumped to sits above the band and the table of contents
  highlights the one before it. The jump target is the heading's own
  `scroll-margin-top`, so the band is read from it rather than restated.
*/
describe('useDocToc', () => {
	const options: IntersectionObserverInit[] = []
	let report: IntersectionObserverCallback = () => {}
	let crossBreakpoint = () => {}

	beforeEach(() => {
		options.length = 0
		vi.stubGlobal('matchMedia', () => ({
			addEventListener: (_: string, listener: () => void) => {
				crossBreakpoint = listener
			},
			removeEventListener() {}
		}))
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(
					callback: IntersectionObserverCallback,
					init: IntersectionObserverInit
				) {
					report = callback
					options.push(init)
				}
				observe() {}
				disconnect() {}
			}
		)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		document.body.innerHTML = ''
	})

	function renderWithHeadings(scrollMarginTop: string) {
		const root = document.createElement('article')
		const headings = ['install', 'configure'].map((id) => {
			const heading = document.createElement('h2')
			heading.id = id
			heading.textContent = id
			heading.style.scrollMarginTop = scrollMarginTop
			root.append(heading)
			return heading
		})
		document.body.append(root)

		// One ref for every render, as a component's `useRef` would be.
		const ref = { current: root }
		return { headings, hook: renderHook(() => useDocToc(ref)) }
	}

	it('starts its band at the headings’ scroll margin', () => {
		renderWithHeadings('68px')

		expect(options.at(-1)?.rootMargin).toBe('-68px 0px -65% 0px')
	})

	it('moves the band when the viewport crosses the nav breakpoint', () => {
		const { headings, hook } = renderWithHeadings('80px')
		expect(options.at(-1)?.rootMargin).toBe('-80px 0px -65% 0px')

		// The reader is on the second section when the phone is rotated.
		act(() =>
			report(
				[
					{
						isIntersecting: true,
						target: headings[1],
						boundingClientRect: { top: 80 }
					} as unknown as IntersectionObserverEntry
				],
				{} as IntersectionObserver
			)
		)
		expect(hook.result.current.activeId).toBe('configure')

		// Rotated to portrait: the token, and so the margin, drops.
		for (const heading of headings) heading.style.scrollMarginTop = '68px'
		vi.stubGlobal('innerWidth', 375)
		act(() => crossBreakpoint())

		expect(options.at(-1)?.rootMargin).toBe('-68px 0px -65% 0px')
		// Rebuilding the band does not send the highlight back to the top.
		expect(hook.result.current.activeId).toBe('configure')
	})
})
