/**
 * One price for a selection, and whether it can be bought.
 *
 * The page used to show the fallback on a card and "Pricing unavailable" in the
 * bar under it, for the same plan, at the same time.
 */

import { describe, expect, it } from 'vitest'

import { describeAnnualSaving, resolvePlanPrice } from './plan-price'

import type { BillingCheckoutOptions } from '../dashboard/dashboard-types'

const NO_LIVE_PRICES: BillingCheckoutOptions = {
	pro: { monthly: null, annual: null },
	business: { monthly: null, annual: null }
}

const LIVE: BillingCheckoutOptions = {
	pro: {
		monthly: {
			priceId: 'price_pro_m',
			amountCents: 2900,
			currency: 'usd',
			interval: 'month',
			intervalCount: 1,
			productName: 'Pro'
		},
		annual: {
			priceId: 'price_pro_y',
			amountCents: 27600,
			currency: 'usd',
			interval: 'year',
			intervalCount: 1,
			productName: 'Pro'
		}
	},
	business: { monthly: null, annual: null }
}

describe('without a live Stripe price', () => {
	it('still shows what the plan costs', () => {
		expect(resolvePlanPrice('pro', 'monthly', NO_LIVE_PRICES)).toEqual({
			perMonthLabel: '$29',
			billedLabel: null,
			priceId: null
		})
	})

	it('shows the annual figure the way it is billed', () => {
		expect(resolvePlanPrice('business', 'annual', NO_LIVE_PRICES)).toEqual({
			perMonthLabel: '$63',
			billedLabel: '$756 billed yearly',
			priceId: null
		})
	})

	it('still names the yearly saving, from the prices it shows', () => {
		/*
		  The saving used to read live prices only, so a page showing the fallback
		  $29 offered no saving beside it. Business: $79 against $63 a month, a
		  year of it.
		*/
		expect(describeAnnualSaving('business', NO_LIVE_PRICES)).toBe('$192')
	})

	it('offers nothing to buy', () => {
		/*
		  `/api/billing/checkout` requires a `price_` id and validates it against
		  Stripe. A fallback figure has none, so it is shown and never submitted.
		*/
		expect(resolvePlanPrice('pro', 'annual', NO_LIVE_PRICES).priceId).toBeNull()
	})
})

describe('with a live Stripe price', () => {
	it('prefers it, and carries the id checkout needs', () => {
		expect(resolvePlanPrice('pro', 'annual', LIVE)).toEqual({
			perMonthLabel: '$23',
			billedLabel: '$276 billed yearly',
			priceId: 'price_pro_y'
		})
	})

	it('names the yearly saving from the live figures', () => {
		expect(describeAnnualSaving('pro', LIVE)).toBe('$72')
	})
})
