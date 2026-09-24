// @vitest-environment jsdom
/**
 * The mission figure is rendered apart, and closes only to open in view.
 *
 * Its sheets separate as the section arrives. The server renders them apart,
 * so without script, under reduced motion, or already on screen at hydration,
 * the figure is simply complete; only a figure waiting below the fold is
 * closed, and it has to open when it is reached.
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { inUnitOf } from './format-bytes'
import { MissionStatement } from './mission-statement'
import { HERO_MODEL } from '../../lib/samples/sample-models'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

let deliver: Callback = () => {}
let reduceMotion = false

beforeEach(() => {
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: Callback) {
				deliver = callback
			}
			observe() {}
			disconnect() {}
		}
	)
	reduceMotion = false
	vi.stubGlobal('matchMedia', () => ({ matches: reduceMotion }))
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		top: 5000
	} as DOMRect)
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const stack = (container: HTMLElement) =>
	container.querySelector('[data-reveal]') as HTMLElement

describe('the mission figure', () => {
	it('closes below the fold and opens when it arrives', () => {
		const { container } = render(<MissionStatement />)
		expect(stack(container).hasAttribute('data-apart')).toBe(false)

		act(() => deliver([{ isIntersecting: true }]))
		expect(stack(container).hasAttribute('data-apart')).toBe(true)
	})

	it('stays apart under reduced motion', () => {
		reduceMotion = true
		const { container } = render(<MissionStatement />)
		expect(stack(container).hasAttribute('data-apart')).toBe(true)
	})

	it('stays apart when it is already on screen', () => {
		vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
			top: 100
		} as DOMRect)
		const { container } = render(<MissionStatement />)
		expect(stack(container).hasAttribute('data-apart')).toBe(true)
	})

	it('labels the sheets with the real sizes of the hero camera', () => {
		render(<MissionStatement />)
		for (const bytes of [HERO_MODEL.sourceBytes, HERO_MODEL.bytes]) {
			const { value, unit } = inUnitOf(bytes, bytes)
			expect(screen.getByText(`${value} ${unit}`)).toBeTruthy()
		}
	})
})
