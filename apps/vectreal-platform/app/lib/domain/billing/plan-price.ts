import { DASHBOARD_LOCALE } from '../../../constants/limit-format'
import { type PaidPlan } from '../../../constants/plan-config'
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
	The one currency formatter. `pricing-cards-section` held a byte-identical
	copy under the name `formatCurrency`, with its own locale constant and its
	own paragraph explaining the same decision.

	`DASHBOARD_LOCALE` rather than the machine default: the page is
	server-rendered, the container declares no LANG, so an unpinned format is
	produced one way on the server and another in the reader's browser, and
	every price becomes a hydration mismatch.

	Whole amounts print without their minor unit, and only whole amounts. Both
	copies forced `maximumFractionDigits: 0`, which is right for the $29 and $79
	the plans cost today and silently wrong for anything else: a Stripe price of
	$29.99 was shown as "$30", a figure nobody would be charged.

	Hundredths, because that is what this account is paid in.

	Deriving the divisor from the currency was tried and reverted. Stripe's
	minor unit is not CLDR's: JPY arrives in whole yen and BHD in thousandths,
	which a fixed 100 gets wrong, but HUF and ISK have zero decimal places in
	CLDR and are still sent multiplied by 100, which the derived version got
	wrong in the opposite direction and by a factor of a hundred. Getting both
	right needs Stripe's own table of special cases, and there is no second
	currency here to justify carrying one: the fallback prices are USD and the
	live prices come from one account that sells in USD.
*/
export function formatPrice(
	amountCents: number,
	currency: string,
	locale: string = DASHBOARD_LOCALE
): string {
	const isWholeAmount = amountCents % 100 === 0

	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currency.toUpperCase(),
		minimumFractionDigits: isWholeAmount ? 0 : 2,
		maximumFractionDigits: isWholeAmount ? 0 : 2
	}).format(amountCents / 100)
}

export function resolvePlanPrice(
	plan: PaidPlan,
	period: BillingPeriod,
	options: BillingCheckoutOptions
): PlanPrice {
	const live = options[plan][period]

	if (live) {
		const perMonthCents =
			period === 'monthly'
				? live.amountCents
				: Math.round(live.amountCents / 12)

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
	plan: PaidPlan,
	options: BillingCheckoutOptions
): string | null {
	const monthly = resolvePlanPrice(plan, 'monthly', options)
	const annual = resolvePlanPrice(plan, 'annual', options)

	// One is live and the other is not, so their difference is not a saving.
	if ((monthly.priceId === null) !== (annual.priceId === null)) return null

	const saved = monthly.perMonthCents * 12 - annual.perMonthCents * 12
	return saved > 0 ? formatPrice(saved, annual.currency) : null
}
