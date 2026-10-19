// @vitest-environment jsdom
/**
 * The home page's first offer has one job: take a brand with photos to the
 * free-model intake, and say what happens there in order.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'

import { PilotBand } from './pilot-band'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.pilot

const renderBand = () =>
	render(
		<MemoryRouter>
			<PilotBand />
		</MemoryRouter>
	)

it('leads to the free-model intake', () => {
	renderBand()
	expect(
		screen.getByRole('link', { name: COPY.cta }).getAttribute('href')
	).toBe('/free-model')
})

it('lists the steps in order, each named by its heading', () => {
	renderBand()
	const steps = within(
		screen.getByRole('list', { name: COPY.stepsLabel })
	).getAllByRole('listitem')
	expect(
		steps.map((step) => within(step).getByRole('heading').textContent)
	).toEqual(COPY.steps.map((step) => step.title))
})
