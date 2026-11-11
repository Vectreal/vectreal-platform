// @vitest-environment jsdom
/**
 * The fold leads with the brand offer: its first action is the free-model
 * intake, and the publisher is the second.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, expect, it, vi } from 'vitest'

import { HeroSheet } from './hero-sheet'
import { HOME_PAGE_COPY } from '../../../constants/product-copy'

const HERO = HOME_PAGE_COPY.hero

// The live stage never mounts here; the fold is complete without it.
vi.mock('./use-mount-when-visible-and-idle', () => ({
	useMountWhenVisibleAndIdle: () => false
}))

beforeAll(() => {
	// jsdom has no ResizeObserver; the sheet measures its readout row with one.
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
})

it('sends the primary action to the free-model intake and the second to the publisher', () => {
	render(
		<MemoryRouter>
			<HeroSheet />
		</MemoryRouter>
	)
	expect(
		screen.getByRole('link', { name: HERO.primaryCta }).getAttribute('href')
	).toBe('/free-model')
	expect(
		screen.getByRole('link', { name: HERO.secondaryCta }).getAttribute('href')
	).toBe('/publisher')
})
