// @vitest-environment jsdom
/**
 * The home page's sections are tall, so its sheet gives each band more room
 * (`sheet-frame.module.css`, `data-spacious`); every other marketing page
 * keeps the frame's usual padding.
 */
import { render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { Band, SheetFrame } from './sheet-frame'

// A band reveals its blocks on scroll; jsdom has neither media queries nor intersections.
beforeEach(() => {
	vi.stubGlobal('matchMedia', () => ({ matches: true }))
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			observe() {}
			disconnect() {}
		}
	)
})
afterEach(() => vi.unstubAllGlobals())

const sheet = (spacious?: boolean) =>
	render(
		<SheetFrame spacious={spacious}>
			<Band aria-label="Section">Content</Band>
		</SheetFrame>
	).container.firstElementChild

it('gives a spacious sheet its bands’ larger padding', () => {
	expect(sheet(true)?.hasAttribute('data-spacious')).toBe(true)
})

it('keeps every other sheet at the frame’s usual padding', () => {
	expect(sheet()?.hasAttribute('data-spacious')).toBe(false)
})
