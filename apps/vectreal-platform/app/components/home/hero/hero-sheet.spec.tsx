// @vitest-environment jsdom
/**
 * The fold leads with the brand offer: its first action is the free-model
 * intake, and the publisher is the second. The model is there from the first
 * paint.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, expect, it, vi } from 'vitest'

import { HERO_STILLS } from './hero-assets'
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

/*
  The model shows from the first paint as a still, each framing its own, and
  the label names no view until the live stage has taken over.
*/
it('server-renders the still, one image per framing, labelled as a figure only', () => {
	const { container } = render(
		<MemoryRouter>
			<HeroSheet />
		</MemoryRouter>
	)
	const still = container.querySelector('picture')
	expect(still?.querySelector('img')?.getAttribute('src')).toBe(
		HERO_STILLS.sheet.url
	)
	expect(
		still
			?.querySelector('source[media="(max-width: 899px)"]')
			?.getAttribute('srcset')
	).toBe(HERO_STILLS.fold.url)
	expect(
		container.querySelector('[data-phase]')?.getAttribute('data-phase')
	).toBe('still')
	expect(
		screen.getByText(HOME_PAGE_COPY.stage.figure, { exact: true })
	).toBeTruthy()
})
