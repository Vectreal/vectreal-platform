// @vitest-environment jsdom
/**
 * A brand finds the price of what the letters and the home page offer: the
 * pilot as the sum of its parts, every price in euros, and the free model as
 * the first way in.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'

import { MadeForYouSection } from './made-for-you-section'
import {
	MADE_FOR_YOU_PRICES,
	PILOT_PRICE,
	PRICING_PAGE_COPY
} from '../../constants/product-copy'

const COPY = PRICING_PAGE_COPY.madeForYou

const renderSection = () =>
	render(
		<MemoryRouter>
			<MadeForYouSection />
		</MemoryRouter>
	)

it('prices the pilot as its five standard models plus the setup', () => {
	expect(PILOT_PRICE).toBe(
		MADE_FOR_YOU_PRICES.pilotModels * MADE_FOR_YOU_PRICES.standard +
			MADE_FOR_YOU_PRICES.setup
	)
	renderSection()
	expect(
		screen.getByText(`€${PILOT_PRICE.toLocaleString('en-US')}`)
	).toBeTruthy()
})

it('shows every price in euros, never dollars', () => {
	const { container } = renderSection()
	expect(container.textContent).not.toContain('$')
	const rows = within(
		screen.getByRole('list', { name: COPY.rowsLabel })
	).getAllByRole('listitem')
	expect(rows).toHaveLength(4)
	for (const row of rows) expect(row.textContent).toContain('€')
})

it('leads to the free model first and the pilot conversation second', () => {
	renderSection()
	expect(
		screen.getByRole('link', { name: COPY.cta }).getAttribute('href')
	).toBe('/free-model')
	expect(
		screen.getByRole('link', { name: COPY.pilotCta }).getAttribute('href')
	).toBe('/contact?topic=pilot')
})
