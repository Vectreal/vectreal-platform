/**
 * What a Stripe price is, in this product's terms.
 *
 * Three questions, asked identically by the checkout action and by the billing
 * dashboard loader: is this product still readable, is this price monthly or
 * annual, and which plan does it sell. Both modules held byte-identical copies
 * of all three. Neither copy was wrong, which is the problem: a resolution rule
 * that lives in two places is a rule that can start disagreeing with itself
 * without either side changing, and the side that decides what checkout charges
 * for is the one where that matters.
 *
 * Types only from `stripe`, so this module carries no runtime import and no db
 * import and a test can reach it. `checkout.ts` cannot be imported by a test at
 * all: `getDbClient()` runs at module scope and throws `Missing DATABASE_URL`.
 * That is the reason the rule lived where it could not be tested, and the reason
 * it moves here rather than into either caller.
 */

import { isPaidPlan, type PaidPlan } from '../../../constants/plan-config'

import type Stripe from 'stripe'

/**
 * Whether the expanded product is still there to read.
 *
 * Stripe returns a bare id when the product was not expanded, and a deleted
 * product as `{ id, deleted: true }` with no metadata. Both would throw on a
 * property read, so neither is a product for our purposes.
 */
export function isStripeProduct(
	product: Stripe.Price['product']
): product is Stripe.Product {
	return (
		typeof product === 'object' &&
		product !== null &&
		!('deleted' in product && product.deleted === true)
	)
}

/**
 * The billing period, when it is one we sell.
 *
 * `interval_count` is checked, not just `interval`: a price billed every three
 * months is recurring and monthly by interval, and calling it our monthly plan
 * would charge a quarter's money against a month's entitlements.
 */
export function getBillingPeriod(
	price: Stripe.Price
): 'monthly' | 'annual' | null {
	if (!price.recurring) {
		return null
	}

	if (
		price.recurring.interval === 'month' &&
		price.recurring.interval_count === 1
	) {
		return 'monthly'
	}

	if (
		price.recurring.interval === 'year' &&
		price.recurring.interval_count === 1
	) {
		return 'annual'
	}

	return null
}

/**
 * The plan written on a Stripe price, by whatever rule the caller accepts.
 *
 * Price metadata first, then the product's. A price can override its product,
 * which is how a promotional price for the same product is still sold as the
 * same plan; falling back the other way would let a product-level default
 * quietly win over a deliberate per-price value. A value the caller does not
 * accept does not stop the search - it is treated as not an answer, so a
 * mistagged price can still be resolved from its product.
 *
 * The acceptance rule is the caller's because the two callers accept different
 * sets, and that is the only thing that differed between the three copies of
 * this search. Checkout will only sell a `PaidPlan`; the webhook sync records
 * whatever plan an organization is actually on, including `free` and
 * `enterprise`. The third copy, in `resolvePlanFromSubscription`, reached the
 * product through a bare `typeof !== 'string'` and a cast, so a deleted product
 * was taken as readable and only an optional chain kept it from throwing.
 */
export function resolvePlanMetadata<T extends string>(
	price: Stripe.Price,
	accept: (value: unknown) => value is T
): T | null {
	const onPrice = price.metadata?.vectreal_plan
	if (accept(onPrice)) {
		return onPrice
	}

	const onProduct = isStripeProduct(price.product)
		? price.product.metadata?.vectreal_plan
		: null

	return accept(onProduct) ? onProduct : null
}

/**
 * The plan this price sells, or nothing.
 *
 * `isPaidPlan` rather than a membership test, so the return type is `PaidPlan`
 * and an unrecognized or non-purchasable `vectreal_plan` value - including
 * `enterprise`, which is sales-led - resolves to `null` rather than to a plan
 * checkout would then try to sell.
 */
export function resolvePlanFromPrice(price: Stripe.Price): PaidPlan | null {
	return resolvePlanMetadata(price, isPaidPlan)
}
