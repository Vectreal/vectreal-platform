// @vitest-environment jsdom
/**
 * Until Stripe is live, a paid plan on /pricing is a conversation: its button
 * says so and opens the contact page, never checkout.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'

import { PricingCardsSection } from './pricing-cards-section'
import { ALL_PLANS } from '../../constants/plan-config'
import {
	PLAN_DISPLAY_NAMES,
	PLAN_HIGHLIGHTED
} from '../../constants/product-copy'

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

it('marks only the highlighted plan as the brand action', () => {
	const { container } = render(
		<MemoryRouter>
			<PricingCardsSection
				period="monthly"
				onPeriodChange={() => undefined}
				prices={null}
			/>
		</MemoryRouter>
	)
	const highlighted = ALL_PLANS.filter((plan) => PLAN_HIGHLIGHTED[plan]).map(
		(plan) => PLAN_DISPLAY_NAMES[plan]
	)
	// The plan a brand action belongs to: the name of the nearest plan around it.
	const planOf = (action: Element) => {
		let cell = action.parentElement
		while (cell && !cell.querySelector('h3')) cell = cell.parentElement
		return cell?.querySelector('h3')?.textContent
	}
	expect(
		[...container.querySelectorAll('[data-variant="brand"]')].map(planOf)
	).toEqual(highlighted)
})
