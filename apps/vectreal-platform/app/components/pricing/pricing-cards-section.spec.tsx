// @vitest-environment jsdom
/**
 * Until Stripe is live, a paid plan on /pricing is a conversation: its button
 * says so and opens the contact page, never checkout.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'

import { ALL_PLANS } from '../../constants/plan-config'
import {
	PLAN_DISPLAY_NAMES,
	PLAN_HIGHLIGHTED
} from '../../constants/product-copy'
import { PricingCardsSection } from './pricing-cards-section'

import type { BillingCheckoutOptions } from '../../lib/domain/dashboard/dashboard-types'

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

/*
  The Stripe account sells in euros, the way production's prices arrive: Pro
  monthly and yearly, Business monthly only. The Free card was the literal "$0"
  and a missing price fell back to a literal "$", so the row read "$0", "€19"
  and, on the yearly toggle, "$63" beside "€14".
*/
const LIVE_EUR: BillingCheckoutOptions = {
	pro: {
		monthly: {
			priceId: 'price_pro_m',
			amountCents: 1900,
			currency: 'eur',
			interval: 'month',
			intervalCount: 1,
			productName: 'Pro'
		},
		annual: {
			priceId: 'price_pro_y',
			amountCents: 16800,
			currency: 'eur',
			interval: 'year',
			intervalCount: 1,
			productName: 'Pro'
		}
	},
	business: {
		monthly: {
			priceId: 'price_business_m',
			amountCents: 6200,
			currency: 'eur',
			interval: 'month',
			intervalCount: 1,
			productName: 'Business'
		},
		annual: null
	}
}

const pricesShown = (
	period: 'monthly' | 'annual',
	prices: BillingCheckoutOptions | null
) => {
	const { container } = render(
		<MemoryRouter>
			<PricingCardsSection
				period={period}
				onPeriodChange={() => undefined}
				prices={prices}
			/>
		</MemoryRouter>
	)
	return {
		text: container.textContent ?? '',
		figures: [...container.querySelectorAll('h3')].map((name) => {
			let cell = name.parentElement
			while (cell && !cell.querySelector('.text-h2')) cell = cell.parentElement
			return [name.textContent, cell?.querySelector('.text-h2')?.textContent]
		})
	}
}

it.each([
	['monthly', LIVE_EUR, { Free: '€0', Pro: '€19', Business: '€62' }],
	['annual', LIVE_EUR, { Free: '€0', Pro: '€14', Business: '€62' }],
	['monthly', null, { Free: '€0', Pro: '€19', Business: '€62' }],
	['annual', null, { Free: '€0', Pro: '€14', Business: '€62' }]
] as const)(
	'prices every plan in euros (%s, live prices: %o)',
	(period, prices, expected) => {
		const { text, figures } = pricesShown(period, prices)
		expect(text).not.toContain('$')
		expect(Object.fromEntries(figures)).toMatchObject(expected)
	}
)

it('shows the live monthly price on the yearly toggle for a plan sold monthly only', () => {
	const business = LIVE_EUR.business.monthly
	if (!business) throw new Error('fixture')
	const raised: BillingCheckoutOptions = {
		...LIVE_EUR,
		business: { monthly: { ...business, amountCents: 6500 }, annual: null }
	}
	expect(
		Object.fromEntries(pricesShown('annual', raised).figures)
	).toMatchObject({ Business: '€65' })
})

it.each([LIVE_EUR, null])(
	'says how a yearly price is billed, live or not (%o)',
	(prices) => {
		expect(pricesShown('annual', prices).text).toContain('€168 billed yearly')
		expect(pricesShown('monthly', prices).text).not.toContain('billed yearly')
	}
)

it.each([LIVE_EUR, null])(
	'labels a plan sold monthly only as billed monthly on the yearly toggle (%o)',
	(prices) => {
		/*
		  Business has no yearly price. Without a label, its unchanged price and
		  missing saving on the yearly toggle read as a mistake.
		*/
		expect(pricesShown('annual', prices).text).toContain('billed monthly')
		expect(pricesShown('monthly', prices).text).not.toContain('billed monthly')
	}
)

it('prices Free in the currency Stripe priced the plans in', () => {
	const usd = JSON.parse(
		JSON.stringify(LIVE_EUR).replaceAll('"eur"', '"usd"')
	) as BillingCheckoutOptions
	const { text, figures } = pricesShown('monthly', usd)
	expect(text).not.toContain('€')
	expect(Object.fromEntries(figures)).toMatchObject({
		Free: '$0',
		Pro: '$19',
		Business: '$62'
	})
})
