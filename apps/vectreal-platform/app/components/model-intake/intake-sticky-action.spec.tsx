// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IntakeLoop } from './intake-loop'
import {
	INTAKE_ACTION_ATTRIBUTE,
	IntakeStickyAction
} from './intake-sticky-action'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void
let observe: Callback = () => {}

beforeEach(() => {
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: Callback) {
				observe = callback
			}
			observe() {}
			disconnect() {}
		}
	)
})

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
})

function page() {
	render(
		<>
			<a href="#hero" {...{ [INTAKE_ACTION_ATTRIBUTE]: '' }}>
				hero
			</a>
			<a href="#end" {...{ [INTAKE_ACTION_ATTRIBUTE]: '' }}>
				end
			</a>
			<IntakeStickyAction>
				<a href="#sticky">sticky</a>
			</IntakeStickyAction>
		</>
	)
	const [hero, end] = screen.getAllByRole('link')
	const sticky = screen.getByText('sticky').parentElement as HTMLElement
	const report = (target: Element, isIntersecting: boolean, bottom: number) =>
		act(() =>
			observe([
				{
					target,
					isIntersecting,
					boundingClientRect: { bottom } as DOMRectReadOnly
				}
			])
		)
	return { hero, end, sticky, report }
}

describe('the sticky request button', () => {
	it('waits until the hero button has scrolled away', () => {
		const { hero, end, sticky, report } = page()
		report(hero, true, 600)
		report(end, false, 3000)
		expect(sticky.getAttribute('aria-hidden')).toBe('true')
		report(hero, false, -40)
		expect(sticky.getAttribute('aria-hidden')).toBe('false')
	})

	it('steps aside while one of the page buttons is in view', () => {
		const { hero, end, sticky, report } = page()
		report(hero, false, -40)
		report(end, true, 700)
		expect(sticky.getAttribute('aria-hidden')).toBe('true')
		report(end, false, 1200)
		expect(sticky.getAttribute('aria-hidden')).toBe('false')
	})
})

describe('a loop', () => {
	it('starts as its poster, described for a screen reader', () => {
		render(
			<IntakeLoop
				src="/a.mp4"
				poster="/a.webp"
				label="Was die Schleife zeigt"
			/>
		)
		expect(screen.getByAltText('Was die Schleife zeigt')).toHaveProperty(
			'src',
			expect.stringContaining('/a.webp')
		)
		expect(document.querySelector('video')).toBeNull()
	})
})
