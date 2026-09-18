import { TIGHT_AT } from './plan-fit'
import {
	getEntitlementDeltaLabels,
	getUnlockedEntitlementLabels
} from './plan-upgrade-features'
import { formatLimitValue } from '../../../constants/limit-format'
import {
	PLAN_ENTITLEMENTS,
	PLAN_LIMITS,
	PURCHASABLE_PLANS,
	RECOMMENDED_UPGRADE,
	type LimitKey,
	type Plan
} from '../../../constants/plan-config'
import {
	LIMIT_DISPLAY_LABELS,
	PLAN_CARD_LIMIT_KEYS,
	PLAN_DISPLAY_NAMES
} from '../../../constants/product-copy'

/**
 * What moving from one plan to another would change, for this organization.
 *
 * The upgrade page answered this with the public pricing page: four plan cards,
 * two of them unselectable, over a seventeen-row entitlement table. A reader on
 * Free choosing Pro had to find the difference themselves, and the table's own
 * shape argued against the purchase - sixteen of its seventeen rows are
 * identical between the two plans. The one that differs is branding; the rest
 * of what Pro sells is room, and room was in a different component above it.
 *
 * So this states the difference and nothing else:
 *
 * - **Only the limits that change.** Free and Pro both allow one seat; a row
 *   reading `1 -> 1` is a row the reader has to read to learn it says nothing.
 * - **The readings this organization has nearly filled, first.** Someone sent
 *   here by "you have used your one project" should meet projects before
 *   folders. `describePlanFit` already decides what counts as nearly full, so
 *   the two pages cannot disagree about it.
 * - **What is gained and what is lost, both.** A Business organization can
 *   move to Pro, and the change takes three entitlements and every limit down
 *   with it. The confirmation page learned to say so after the fact
 *   (`plan-change-outcome.ts`); this says it before the money moves.
 *
 * Direction is read from the config rather than from which plan is "higher":
 * a change is a reduction when it takes something away, the same rule the
 * confirmation page uses, so no ordering has to be written down twice.
 */

/*
	Pinned for the reason `plan-fit.ts` pins it: Business allows 2,000 scenes, and
	digit grouping differs between the container rendering this page and a
	browser outside the US.
*/
const DASHBOARD_LOCALE = 'en-US'

export type LimitChange = 'raised' | 'lowered'

export interface PlanComparisonRow {
	key: LimitKey
	label: string
	fromLabel: string
	toLabel: string
	change: LimitChange
	/** Nearly full or full on the current plan - the reason the reader is here. */
	isTight: boolean
	atLimit: boolean
}

export interface PlanComparison {
	fromLabel: string
	toLabel: string
	/** Takes an entitlement away or lowers a limit. */
	isReduction: boolean
	/**
	 * Why this change matters, as a statement: what is full, or what the change
	 * does. The page's heading, so it reads as the point rather than a caption.
	 */
	title: string
	/** What follows from it. `null` when the title already says everything. */
	detail: string | null
	rows: PlanComparisonRow[]
	gained: string[]
	lost: string[]
}

/**
 * How full a limit is. An unknown figure or an unlimited limit is never full,
 * and a limit of zero cannot be divided by.
 */
function shareOf(value: number | undefined, limit: number | null): number {
	if (value === undefined || limit === null || limit <= 0) return 0
	return value / limit
}

/** `null` is unlimited, the top of the range rather than zero. */
function bound(value: number | null): number {
	return value === null ? Number.POSITIVE_INFINITY : value
}

/**
 * Whether filling this limit is what would actually refuse the reader.
 *
 * Only `org_seats` answers no, and only on a plan that has no second seat to
 * give. Free and Pro both allow one member and neither carries
 * `org_multi_member`, so an invite is refused by the entitlement in
 * `organizations.$organizationId.tsx` before `inviteOrganizationMember` ever
 * counts a seat. Reading the count as a filled quota turned "you are one
 * person" into an urgent reason: every free organization was told its team
 * seats were full, which was true by arithmetic and had refused nobody. What
 * a multi-member plan adds is carried by the entitlement row instead, where
 * the reader can act on it.
 */
function isRefusalReason(key: LimitKey, plan: Plan): boolean {
	return key !== 'org_seats' || PLAN_ENTITLEMENTS[plan].org_multi_member
}

export interface PlanComparisonUsage {
	/**
	 * Raw figures by limit, used only to decide which limits are full. No figure
	 * reaches the page: how much room is left is `/dashboard/usage`'s to show,
	 * and a plan comparison that tells a reader they use 2 of 200 scenes argues
	 * against the change it exists to explain.
	 */
	used: Partial<Record<LimitKey, number>>
}

export function comparePlans(
	from: Plan,
	to: Plan,
	{ used }: PlanComparisonUsage = { used: {} }
): PlanComparison {
	const fromLabel = PLAN_DISPLAY_NAMES[from]
	const toLabel = PLAN_DISPLAY_NAMES[to]

	const changed = PLAN_CARD_LIMIT_KEYS.filter(
		(key) => bound(PLAN_LIMITS[from][key]) !== bound(PLAN_LIMITS[to][key])
	).map((key): PlanComparisonRow => ({
		key,
		label: LIMIT_DISPLAY_LABELS[key],
		fromLabel: formatLimitValue(key, PLAN_LIMITS[from][key], DASHBOARD_LOCALE),
		toLabel: formatLimitValue(key, PLAN_LIMITS[to][key], DASHBOARD_LOCALE),
		change:
			bound(PLAN_LIMITS[to][key]) > bound(PLAN_LIMITS[from][key])
				? 'raised'
				: 'lowered',
		isTight:
			isRefusalReason(key, from) &&
			shareOf(used[key], PLAN_LIMITS[from][key]) >= TIGHT_AT,
		atLimit:
			isRefusalReason(key, from) &&
			shareOf(used[key], PLAN_LIMITS[from][key]) >= 1
	}))

	/*
	  The readings that brought the reader here lead, fullest first. Decided from
	  the figures on every counted limit, not only the five the usage record
	  holds: an organization refused its third API key is here because of API
	  keys, and a reason read from a narrower list never named it.
	*/
	const rows = [
		...changed
			.filter((row) => row.isTight)
			.sort(
				(a, b) =>
					shareOf(used[b.key], PLAN_LIMITS[from][b.key]) -
					shareOf(used[a.key], PLAN_LIMITS[from][a.key])
			),
		...changed.filter((row) => !row.isTight)
	]

	/*
	  The split `plan-change-outcome.ts` uses for the same two lists: what is
	  gained is a display and takes the one cap, what is lost is a fact and may
	  not quietly stop at six.
	*/
	const gained = getUnlockedEntitlementLabels(from, to)
	const lost = getEntitlementDeltaLabels(to, from)
	const isReduction =
		lost.length > 0 || rows.some((row) => row.change === 'lowered')

	/*
	  What is full is a fact about the plan held, so it is read from every limit
	  on it rather than from the rows, which hold only the ones this target
	  changes. A limit that is full and identical on both plans is still full,
	  and answering "nothing is full yet" because the target does not happen to
	  raise it was how the page told an organization sitting at its limit that it
	  had room.
	*/
	const full = PLAN_CARD_LIMIT_KEYS.filter(
		(key) =>
			isRefusalReason(key, from) &&
			shareOf(used[key], PLAN_LIMITS[from][key]) >= 1
	).map((key) => LIMIT_DISPLAY_LABELS[key])

	return {
		fromLabel,
		toLabel,
		isReduction,
		...describeWhy({ fromLabel, toLabel, isReduction, rows, full }),
		rows,
		gained,
		lost
	}
}

function joinLabels(labels: string[]): string {
	if (labels.length <= 1) return labels.join('')
	return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

function describeWhy({
	fromLabel,
	toLabel,
	isReduction,
	rows,
	full
}: {
	fromLabel: string
	toLabel: string
	isReduction: boolean
	rows: PlanComparisonRow[]
	/** Labels of every limit already full on the plan held, not only changed ones. */
	full: string[]
}): Pick<PlanComparison, 'title' | 'detail'> {
	if (isReduction) {
		/*
		  Stated as a fact about the plans, not a warning about the reader. Whether
		  they fit inside it is theirs to read from the rows, which carry their own
		  numbers where they are close.
		*/
		return {
			title: `${toLabel} has less room than ${fromLabel}.`,
			detail: null
		}
	}

	if (full.length > 0) {
		/*
		  Every full reading, not the first. A free organization at its one project
		  and its two API keys is blocked twice, and naming one of them sends the
		  reader away believing the other is fine.
		*/
		return {
			title: `${joinLabels(full)} ${
				full.length === 1 ? 'is' : 'are'
			} full on ${fromLabel}.`,
			detail: null
		}
	}

	const lead = rows[0]
	if (lead !== undefined && lead.isTight) {
		return {
			title: `${lead.label} is close to its limit on ${fromLabel}.`,
			detail: null
		}
	}

	/*
	  Said about the limits that change, which is the set the table shows. "It
	  raises every limit on Free" was false for every reader of it: Free and Pro
	  allow one member each, so at least one limit is carried across unchanged
	  and a promise about all of them cannot hold. A non-reduction does raise
	  every row it shows, because no plan offers less than the plan below it -
	  `plan-config.spec.ts` enforces that as a mapping.
	*/
	return {
		title: `Every limit that changes goes up on ${toLabel}.`,
		detail: `Nothing on ${fromLabel} is full yet.`
	}
}

/**
 * The plans this organization could change to from here, in ladder order.
 *
 * Everything checkout sells except the plan already held. Business can see Pro
 * - checkout supports the move and the portal offers it anyway - and the page
 * says what it costs them rather than hiding the option.
 */
export function getPlanChangeTargets(current: Plan): Plan[] {
	return PURCHASABLE_PLANS.filter((plan) => plan !== current)
}

/**
 * Which target to open on, if any.
 *
 * The one asked for, when it is one this organization can move to; otherwise
 * the next plan up, when checkout sells it; otherwise nothing. A missing
 * parameter used to mean Pro for everyone, so a Business reader arrived with a
 * downgrade already selected and a button to confirm it.
 *
 * **Nothing is a real answer.** For Business every plan checkout sells is a step
 * down, and for Enterprise both are. Those readers are shown what they hold and
 * where the next conversation is, and can still open a lower plan by choosing
 * it - they are never placed on one.
 */
export function resolveInitialTarget(
	current: Plan,
	requested: string | null
): Plan | null {
	const asked = getPlanChangeTargets(current).find((plan) => plan === requested)
	if (asked) return asked

	const next = RECOMMENDED_UPGRADE[current]
	return next !== null && PURCHASABLE_PLANS.includes(next) ? next : null
}
