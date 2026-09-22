/**
 * What a Stripe price is, in this product's terms.
 *
 * These three rules decided what checkout charges for, from two byte-identical
 * copies in `checkout.ts` and `billing-dashboard-loader.server.ts`. Neither was
 * reachable from a test: `checkout.ts` calls `getDbClient()` at module scope and
 * throws `Missing DATABASE_URL` on import. So the rules had never been asserted
 * anywhere, in either copy. They are asserted here once.
 */

import { describe, expect, it } from 'vitest'

import {
	getBillingPeriod,
	isStripeProduct,
	resolvePlanFromPrice
} from './stripe-price-plan'

import type Stripe from 'stripe'

/**
 * Only the fields these rules read. The real `Stripe.Price` carries about forty
 * more, and spelling them out would make each case unreadable without making it
 * truer: a cast here is a fixture shortcut, not a claim about the type.
 */
function price(shape: {
	metadata?: Record<string, string>
	product?: Stripe.Price['product']
	recurring?: { interval: string; interval_count: number } | null
}): Stripe.Price {
	return {
		metadata: shape.metadata ?? {},
		product: shape.product ?? 'prod_bare_id',
		recurring: shape.recurring ?? null
	} as unknown as Stripe.Price
}

function product(metadata: Record<string, string>): Stripe.Product {
	return { id: 'prod_1', metadata } as unknown as Stripe.Product
}

describe('which plan a price sells', () => {
	it('reads the plan off the price', () => {
		expect(resolvePlanFromPrice(price({ metadata: { vectreal_plan: 'pro' } })))
			.toBe('pro')
	})

	it('falls back to the product when the price says nothing', () => {
		expect(
			resolvePlanFromPrice(
				price({ product: product({ vectreal_plan: 'business' }) })
			)
		).toBe('business')
	})

	/*
	  The order is the rule, not an implementation detail. A promotional price
	  attached to the same product is how a plan is discounted, so the price has
	  to win; reading the product first would sell every promotional price as
	  whatever the product's default says, and the two copies of this function
	  could have drifted on exactly this line without either looking wrong.
	*/
	it('prefers the price over the product when they disagree', () => {
		expect(
			resolvePlanFromPrice(
				price({
					metadata: { vectreal_plan: 'pro' },
					product: product({ vectreal_plan: 'business' })
				})
			)
		).toBe('pro')
	})

	/*
	  Enterprise is a `Plan` and is not purchasable. A price tagged with it is a
	  misconfiguration in the Stripe dashboard, and the safe reading of it is
	  "nothing we sell" rather than "sell enterprise".
	*/
	it('refuses a plan checkout cannot sell', () => {
		expect(
			resolvePlanFromPrice(price({ metadata: { vectreal_plan: 'enterprise' } }))
		).toBeNull()
		expect(
			resolvePlanFromPrice(price({ metadata: { vectreal_plan: 'free' } }))
		).toBeNull()
	})

	it('refuses a value that is not a plan at all', () => {
		expect(
			resolvePlanFromPrice(price({ metadata: { vectreal_plan: 'toString' } }))
		).toBeNull()
		expect(resolvePlanFromPrice(price({}))).toBeNull()
	})

	/*
	  An unexpanded product is a bare id string and a deleted one carries no
	  metadata. Both used to be reached through the same property access, so
	  either would have thrown inside a loop over every active price.
	*/
	it('survives an unexpanded or deleted product', () => {
		expect(resolvePlanFromPrice(price({ product: 'prod_abc' }))).toBeNull()
		expect(
			resolvePlanFromPrice(
				price({
					product: { id: 'prod_1', deleted: true } as Stripe.DeletedProduct
				})
			)
		).toBeNull()
	})
})

describe('whether the product can be read', () => {
	it('accepts an expanded product and rejects the rest', () => {
		expect(isStripeProduct(product({}))).toBe(true)
		expect(isStripeProduct('prod_abc')).toBe(false)
		expect(
			isStripeProduct({ id: 'p', deleted: true } as Stripe.DeletedProduct)
		).toBe(false)
	})
})

describe('which period a price bills on', () => {
	it('names the two periods we sell', () => {
		expect(
			getBillingPeriod(
				price({ recurring: { interval: 'month', interval_count: 1 } })
			)
		).toBe('monthly')
		expect(
			getBillingPeriod(
				price({ recurring: { interval: 'year', interval_count: 1 } })
			)
		).toBe('annual')
	})

	it('refuses a one-off price', () => {
		expect(getBillingPeriod(price({ recurring: null }))).toBeNull()
	})

	/*
	  `interval_count` is the load-bearing half. A price billed every three months
	  is recurring, and its interval is `month`; taking it as our monthly plan
	  would charge a quarter of money against a month of entitlements. Same for a
	  two-year price read as annual.
	*/
	it('refuses a multiple of a period we do sell', () => {
		expect(
			getBillingPeriod(
				price({ recurring: { interval: 'month', interval_count: 3 } })
			)
		).toBeNull()
		expect(
			getBillingPeriod(
				price({ recurring: { interval: 'year', interval_count: 2 } })
			)
		).toBeNull()
	})

	it('refuses an interval we do not sell', () => {
		expect(
			getBillingPeriod(
				price({ recurring: { interval: 'week', interval_count: 1 } })
			)
		).toBeNull()
	})
})
