// @vitest-environment jsdom
/**
 * Until Stripe is live, a paid plan on /pricing is a conversation: its button
 * says so and opens the contact page, never checkout.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'

import { PricingCardsSection } from './pricing-cards-section'

it('sends Pro and Business to the contact page, not checkout', () => {
	render(
		<MemoryRouter>
			<PricingCardsSection
				period="monthly"
				onPeriodChange={() => undefined}
				prices={null}
			/>
		</MemoryRouter>
	)
	const talk = screen.getAllByRole('link', { name: 'Talk to us' })
	expect(talk.map((link) => link.getAttribute('href'))).toEqual([
		'/contact',
		'/contact'
	])
	expect(
		screen
			.getAllByRole('link')
			.some((link) => link.getAttribute('href')?.includes('/billing/upgrade'))
	).toBe(false)
})
