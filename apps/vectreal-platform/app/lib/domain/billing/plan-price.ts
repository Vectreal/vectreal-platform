import { PLAN_FALLBACK_PRICES } from '../../../constants/product-copy'

import type { BillingCheckoutOptions } from '../dashboard/dashboard-types'

/**
 * What a plan costs, from one source, and whether it can be bought.
 *
 * The upgrade page priced the same selection twice. The plan card fell back to
 * `PLAN_FALLBACK_PRICES` when Stripe returned nothing and read `$29 / month`;
 * the checkout bar read only the live price and, 400px below the card, said
 * "Pricing unavailable for this selection". Both were rendering at once on
 * every local run.
 *
 * Display and purchase are separate questions and are answered separately here.
 * A price can always be shown - the fallback is the documented reference, and
 * `/pricing` publishes it. A price can only be *bought* with a live Stripe price
 * id, because that is what `/api/billing/checkout` validates, so `priceId` is
 * `null` whenever the figure on screen is the fallback.
 */

export type BillingPeriod = 'monthly' | 'annual'

export interface PlanPrice {
	/** Per month, whichever period is billed: `$29` or `$23`. */
	perMonthLabel: string
	/** How it is billed, when that is not simply monthly: `$276 billed yearly`. */
	billedLabel: string | null
	/** What checkout needs. `null` when there is no live price to sell. */
	priceId: string | null
	/**
	 * The figure behind `perMonthLabel`. Carried so a saving is arithmetic on
	 * the prices actually shown rather than a second lookup that can read a
	 * different price list.
	 */
	perMonthCents: number
	currency: string
}

/*
	`en-US` rather than the machine default, which is what this used to pass. The
	page is server-rendered, so an unpinned currency format is produced by the
	container and again by the browser.
*/
export function formatPrice(amountCents: number, currency: string): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: currency.toUpperCase(),
		maximumFractionDigits: 0
	}).format(amountCents / 100)
}

export function resolvePlanPrice(
	plan: 'pro' | 'business',
	period: BillingPeriod,
	options: BillingCheckoutOptions
): PlanPrice {
	const live = options[plan][period]

	if (live) {
		const perMonthCents =
			period === 'monthly' ? live.amountCents : Math.round(live.amountCents / 12)

		return {
			perMonthLabel: formatPrice(perMonthCents, live.currency),
			billedLabel:
				period === 'monthly'
					? null
					: `${formatPrice(live.amountCents, live.currency)} billed yearly`,
			priceId: live.priceId,
			perMonthCents,
			currency: live.currency
		}
	}

	/*
	  The record is `Partial` only because Free and Enterprise have no price; both
	  plans this accepts carry one, and `product-copy.spec.ts` pins them.
	*/
	const fallback = PLAN_FALLBACK_PRICES[plan] as {
		monthly: number
		annualMonthly: number
	}

	const perMonthCents =
		(period === 'monthly' ? fallback.monthly : fallback.annualMonthly) * 100

	return {
		perMonthLabel: formatPrice(perMonthCents, 'usd'),
		billedLabel:
			period === 'monthly'
				? null
				: `${formatPrice(perMonthCents * 12, 'usd')} billed yearly`,
		priceId: null,
		perMonthCents,
		currency: 'usd'
	}
}

/**
 * What paying yearly saves, offered only when yearly is a real option.
 *
 * Derived from the two prices this module would put on screen, rather than
 * from the live options directly. Those are not the same source whenever
 * Stripe has one period and not the other: a live monthly price with no annual
 * price showed the reader a live figure and a saving computed against the
 * documented fallback, so the two numbers on the panel came from different
 * price lists and their difference was not the saving.
 *
 * `null` also means "do not offer", which is the other half of the same
 * defect. Taking the offer switches the panel to the annual price, and a
 * period with no live price cannot be bought - so an offer made across that
 * boundary sent a reader who could have paid to a "Contact us" button. The
 * offer is made only when yearly can be bought on the same terms as monthly.
 */
export function describeAnnualSaving(
	plan: 'pro' | 'business',
	options: BillingCheckoutOptions
): string | null {
	const monthly = resolvePlanPrice(plan, 'monthly', options)
	const annual = resolvePlanPrice(plan, 'annual', options)

	// One is live and the other is not, so their difference is not a saving.
	if ((monthly.priceId === null) !== (annual.priceId === null)) return null

	const saved = monthly.perMonthCents * 12 - annual.perMonthCents * 12
	return saved > 0 ? formatPrice(saved, annual.currency) : null
}
