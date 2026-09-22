import {
	getEntitlementDeltaLabels,
	getUnlockedEntitlementLabels
} from './plan-upgrade-features'
import {
	formatLimitValue,
	PUBLISHED_COPY_LOCALE
} from '../../../constants/limit-format'
import {
	isPaidPlan,
	PLAN_ENTITLEMENTS,
	PLAN_LIMITS,
	type LimitKey,
	type Plan
} from '../../../constants/plan-config'
import {
	LIMIT_DISPLAY_LABELS,
	PLAN_DISPLAY_NAMES
} from '../../../constants/product-copy'

/**
 * What a completed plan change actually was, and what to say about it.
 *
 * The confirmation page used to decide this itself, and it had no notion of
 * direction at all. The word came from `isDirectUpdate ? 'Upgraded to X' :
 * 'Welcome to X!'` - a question about which code path Stripe took, answered as
 * if it were a question about which way the plan moved. So every direct change
 * read as an upgrade, including one that is not.
 *
 * `business -> pro` is reachable from a Business customer's own billing page,
 * and renders "Upgraded to Pro" over "All features are available immediately."
 * while three entitlements and all eight limits go the other way. Checkout is
 * held shut behind a kill switch against a sandbox Stripe account, so no
 * customer has met it.
 *
 * The direction is not a fifth thing to look up. It is a property of the two
 * plans, and the config that defines them already answers it: a change is a
 * reduction when it takes something away. That is asked here, once, so no
 * surface has to assume.
 *
 * This lives outside the route because the route cannot be imported by a test:
 * it reaches `user-repository.server.ts`, which calls `getDbClient()` at module
 * scope. Every branch below is reachable from a spec; none of it would be if it
 * stayed in the component.
 */

export type PlanChangeKind =
	/** Same plan, different billing period. */
	| 'period_switch'
	/** Arrived through Stripe Checkout: there was no prior paid plan. */
	| 'new_subscription'
	/** A direct update that takes nothing away. */
	| 'upgrade'
	/** A direct update that takes something away, whether or not it also adds. */
	| 'reduction'
	/** The parameters did not name a plan we sell, so nothing can be claimed. */
	| 'unconfirmed'

export interface ReducedLimit {
	key: LimitKey
	label: string
	from: string
	to: string
}

export interface PlanChangeOutcome {
	kind: PlanChangeKind
	/** The name of the plan now held, when the parameters named one we sell. */
	planLabel: string | null
	/** The plan the arrow points away from, on a direct tier change. */
	fromPlan: Plan | null
	fromPlanLabel: string | null
	title: string
	subtitle: string
	/** Entitlement labels the new plan adds. */
	gained: string[]
	/**
	 * Every entitlement the old plan had and the new one does not. Exhaustive,
	 * unlike `gained`: a list of what is being taken away may not stop at six.
	 */
	lost: string[]
	/** Every limit the new plan sets lower than the old one. */
	reducedLimits: ReducedLimit[]
}

function toPlan(value: string | null): Plan | null {
	const plans = Object.keys(PLAN_ENTITLEMENTS) as Plan[]
	return plans.find((plan) => plan === value) ?? null
}

/*
	`null` is unlimited, which is the top of the range and not a number. Ranking
	it as infinity puts both cases on the ordinary comparison and leaves no
	branch that the shipped plans cannot reach: today only `pro` and `business`
	can be the destination and neither holds a `null`, so a dedicated
	"the new limit is unlimited" arm would be dead code. Comparing the raw values
	instead would read `null` as 0, and since every `null` here sits on the
	`before` side, it would report a move off Enterprise as reducing nothing.
*/
function limitRank(value: number | null): number {
	return value === null ? Number.POSITIVE_INFINITY : value
}

/*
	The locale is pinned rather than left to the reader. This page is
	server-rendered and then hydrated, so the two renders have to agree on digit
	grouping, and this module has no reader locale to agree on.
*/
function getReducedLimits(from: Plan, to: Plan): ReducedLimit[] {
	const before = PLAN_LIMITS[from]
	const after = PLAN_LIMITS[to]

	return (Object.keys(after) as LimitKey[])
		.filter((key) => limitRank(after[key]) < limitRank(before[key]))
		.map((key) => ({
			key,
			label: LIMIT_DISPLAY_LABELS[key],
			from: formatLimitValue(key, before[key], PUBLISHED_COPY_LOCALE),
			to: formatLimitValue(key, after[key], PUBLISHED_COPY_LOCALE)
		}))
}

export function describePlanChange({
	planId,
	billingPeriod,
	fromPlan,
	isDirectUpdate
}: {
	planId: string | null
	billingPeriod: string | null
	fromPlan: string | null
	isDirectUpdate: boolean
}): PlanChangeOutcome {
	/*
		Only the plans checkout sells. A confirmation naming `free` or
		`enterprise` describes a purchase that cannot have happened here.
	*/
	const plan: Plan | null = isPaidPlan(planId) ? planId : null
	const planLabel = plan ? PLAN_DISPLAY_NAMES[plan] : null

	const isPeriodSwitch = isDirectUpdate && fromPlan === planId

	/*
		What the reader is compared against. This is not the same question as
		what the arrow shows, and conflating them was a bug: `isDirectUpdate`
		says which code path Stripe took, not whether there was a prior plan.
		`checkout.ts` sends everything `planChangeAppliesImmediately` refuses - `past_due`,
		`trialing` - down the hosted-Checkout path carrying its real `from_plan`,
		so gating the comparison on the path told a past-due Business org buying
		Pro that it was welcome and had gained something.

		Known limit, filed rather than fixed here: `from_plan` carries the stored
		plan and not the effective one, so a `canceled` org is compared against a
		plan whose entitlements it had already lost.
	*/
	const comparisonBase: Plan =
		(isPeriodSwitch ? null : toPlan(fromPlan)) ?? 'free'

	/* The arrow is a display, and stays on the path that has always drawn it. */
	const previousPlan =
		isDirectUpdate && !isPeriodSwitch ? toPlan(fromPlan) : null

	const comparable = plan !== null && !isPeriodSwitch
	const gained = comparable
		? getUnlockedEntitlementLabels(comparisonBase, plan)
		: []
	/*
		The same question asked the other way round, and uncapped. What the old
		plan holds over the new one is exactly what this change takes away.
	*/
	const lost = comparable ? getEntitlementDeltaLabels(plan, comparisonBase) : []
	const reducedLimits = comparable ? getReducedLimits(comparisonBase, plan) : []

	const base = {
		planLabel,
		fromPlan: previousPlan,
		fromPlanLabel: previousPlan ? PLAN_DISPLAY_NAMES[previousPlan] : null,
		gained,
		lost,
		reducedLimits
	}

	if (isPeriodSwitch && planLabel) {
		const periodLabel = billingPeriod === 'annual' ? 'annual' : 'monthly'
		return {
			...base,
			kind: 'period_switch',
			title: `Switched to ${periodLabel} billing`,
			subtitle:
				billingPeriod === 'annual'
					? `Your ${planLabel} subscription is now billed once per year.`
					: `Your ${planLabel} subscription is now billed monthly.`
		}
	}

	if (planLabel && (lost.length > 0 || reducedLimits.length > 0)) {
		return {
			...base,
			kind: 'reduction',
			title: `Switched to ${planLabel}`,
			subtitle: `Your plan is now ${planLabel}. What it no longer includes is listed below.`
		}
	}

	if (planLabel) {
		return {
			...base,
			kind: isDirectUpdate ? 'upgrade' : 'new_subscription',
			title: isDirectUpdate
				? `Upgraded to ${planLabel}`
				: `Welcome to ${planLabel}!`,
			subtitle: isDirectUpdate
				? 'All features are available immediately.'
				: 'Your plan is now active and all features are available immediately.'
		}
	}

	return {
		...base,
		kind: 'unconfirmed',
		title: "Payment received - you're all set",
		subtitle:
			'Your subscription is being activated and will be ready momentarily.'
	}
}
