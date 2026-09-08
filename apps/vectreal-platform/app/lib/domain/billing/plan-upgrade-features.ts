import {
	PLAN_ENTITLEMENTS,
	type EntitlementKey,
	type Plan
} from '../../../constants/plan-config'
import {
	ENTITLEMENT_DISPLAY_LABELS,
	UPGRADE_FEATURE_HIGHLIGHT_KEYS
} from '../../../constants/product-copy'

/**
 * What moving from one plan to another actually unlocks.
 *
 * This was computed twice and the two answers could differ. The upgrade page
 * took the whole `PLAN_ENTITLEMENTS` delta; the success page took only the part
 * of it named in `UPGRADE_FEATURE_HIGHLIGHT_KEYS`, which lists 4 of the 17 keys.
 * So an entitlement outside that list would be promised to a buyer before
 * payment and missing from the page confirming what they had bought.
 *
 * No customer met it, because both callers target a `PaidPlan` and every key
 * gainable that way happens to be in the highlight list. It is still real, and
 * the config shows it: `business -> enterprise` gains `support_dedicated`, which
 * the list does not name, so the old success page returned nothing for a move
 * the upgrade page described.
 *
 * They also capped differently, six against five - the same defect latent by
 * another route, since a sixth unlocked feature would have been promised and not
 * confirmed. One cap now, applied here. A caller could still slice the result
 * again; nothing but review stops that, and the spec says so.
 *
 * `UPGRADE_FEATURE_HIGHLIGHT_KEYS` survives as what its name says: the ones
 * worth leading with. It orders the list and can no longer remove anything.
 */

/*
	Six is the upgrade page's existing cap and the longer of the two. It has to
	stay above the highlight list's length, or the list becomes a filter again by
	arithmetic. The largest delta the shipped config can produce is five.
*/
export const UPGRADE_FEATURE_DISPLAY_LIMIT = 6

type EntitlementTable = Record<Plan, Record<EntitlementKey, boolean>>

/*
	A finite rank rather than Infinity: two unlisted keys would otherwise subtract
	to NaN. Sort treats that as 0 and leaves them in insertion order, which is what
	is wanted, but arriving there through NaN reads like a bug.
*/
function highlightRank(key: EntitlementKey): number {
	const index = UPGRADE_FEATURE_HIGHLIGHT_KEYS.indexOf(key)
	return index === -1 ? UPGRADE_FEATURE_HIGHLIGHT_KEYS.length : index
}

/**
 * The labels to show for an upgrade, ordered and capped.
 *
 * A downgrade and a move to the same plan both gain nothing, so both return
 * `[]` from the delta itself rather than from a special case.
 *
 * `entitlements` exists so a test can supply a table with more gained keys than
 * the cap. The shipped config cannot: its largest delta is five.
 */
export function getUnlockedEntitlementLabels(
	from: Plan,
	to: Plan,
	entitlements: EntitlementTable = PLAN_ENTITLEMENTS
): string[] {
	const before = entitlements[from]
	const after = entitlements[to]

	return (Object.keys(after) as EntitlementKey[])
		.filter((key) => after[key] && !before[key])
		.sort((a, b) => highlightRank(a) - highlightRank(b))
		.map((key) => ENTITLEMENT_DISPLAY_LABELS[key])
		.slice(0, UPGRADE_FEATURE_DISPLAY_LIMIT)
}
