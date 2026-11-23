/**
 * One price for a selection, and whether it can be bought.
 *
 * The page used to show the fallback on a card and "Pricing unavailable" in the
 * bar under it, for the same plan, at the same time.
 */

import { describe, expect, it } from 'vitest'

import {
	describeAnnualSaving,
	formatPrice,
	resolvePlanPrice
} from './plan-price'

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
			perMonthLabel: '€19',
			billedLabel: null,
			priceId: null,
			perMonthCents: 1900,
			currency: 'eur'
		})
	})

	it('shows the annual figure the way it is billed', () => {
		expect(resolvePlanPrice('pro', 'annual', NO_LIVE_PRICES)).toEqual({
			perMonthLabel: '€14',
			billedLabel: '€168 billed yearly',
			priceId: null,
			perMonthCents: 1400,
			currency: 'eur'
		})
	})

	it('shows a plan with no yearly price at its monthly price, billed monthly', () => {
		/*
		  Stripe sells Business monthly only. The yearly toggle used to show a
		  yearly Business figure nobody could be charged.
		*/
		expect(resolvePlanPrice('business', 'annual', NO_LIVE_PRICES)).toEqual({
			perMonthLabel: '€62',
			billedLabel: null,
			priceId: null,
			perMonthCents: 6200,
			currency: 'eur'
		})
		expect(describeAnnualSaving('business', NO_LIVE_PRICES)).toBeNull()
	})

	it('still names the yearly saving, from the prices it shows', () => {
		/*
		  The saving used to read live prices only, so a page showing the fallback
		  price offered no saving beside it. Pro: €19 against €14 a month, a year
		  of it.
		*/
		expect(describeAnnualSaving('pro', NO_LIVE_PRICES)).toBe('€60')
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
			priceId: 'price_pro_y',
			perMonthCents: 2300,
			currency: 'usd'
		})
	})

	/*
	  A price that is not a whole number of dollars prints its cents. Both copies
	  of this formatter forced `maximumFractionDigits: 0`, which is right for the
	  $29 and $79 the plans cost today and shows a $29.99 Stripe price as "$30" -
	  a figure nobody would be charged.
	*/
	it('shows cents when the price has them, and not when it does not', () => {
		expect(formatPrice(2999, 'usd')).toBe('$29.99')
		expect(formatPrice(2900, 'usd')).toBe('$29')
	})

	it('names the yearly saving from the live figures', () => {
		expect(describeAnnualSaving('pro', LIVE)).toBe('$72')
	})
})
