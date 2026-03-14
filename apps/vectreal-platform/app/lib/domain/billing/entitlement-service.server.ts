/**
 * Entitlement resolution service.
 *
 * Implements the resolution logic defined in prd/03-entitlements.md:
 *
 *   hasEntitlement(orgId, entitlementKey):
 *     1. Resolve org's current plan (considering billing state)
 *     2. If billing state blocks access → return false
 *     3. Look up entitlement key in plan_entitlements map
 *     4. Check for org-level overrides (enterprise add-ons) → merge
 *     5. Return resolved boolean
 *
 * And the quota limit logic defined in prd/02-limits-and-quotas.md.
 */

import { and, eq } from 'drizzle-orm'

import {
	BLOCKING_BILLING_STATES,
	type BillingState,
	type EntitlementKey,
	type LimitKey,
	type Plan,
	PLAN_ENTITLEMENTS,
	PLAN_LIMITS
} from '../../../constants/plan-config'
import { getDbClient } from '../../../db/client'
import { orgEntitlementOverrides } from '../../../db/schema/billing/org-entitlement-overrides'
import { orgLimitOverrides } from '../../../db/schema/billing/org-limit-overrides'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgSubscriptionRecord {
	plan: Plan
	billingState: BillingState
}

export interface EntitlementDecision {
	/** Whether the feature is currently accessible. */
	granted: boolean
	/** The effective plan used for the decision (may differ from subscribed plan). */
	effectivePlan: Plan
	/** The current billing state. */
	billingState: BillingState
	/** True when an org-level override was applied. */
	overridden: boolean
}

export interface QuotaDecision {
	/**
	 * The resolved limit value.
	 * `null` = unlimited (enterprise custom or override without a value).
	 */
	limit: number | null
	/** True when an org-level override was applied. */
	overridden: boolean
	/** The effective plan used for the decision. */
	effectivePlan: Plan
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the effective plan considering the billing state.
 * If the billing state blocks access the org is treated as `free`.
 */
function resolveEffectivePlan(plan: Plan, billingState: BillingState): Plan {
	if (BLOCKING_BILLING_STATES.has(billingState)) {
		return 'free'
	}
	return plan
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches an org's subscription record from the database.
 * Returns free/none defaults when no subscription row exists.
 */
export async function getOrgSubscription(
	organizationId: string
): Promise<OrgSubscriptionRecord> {
	const db = getDbClient()

	const rows = await db
		.select({
			plan: orgSubscriptions.plan,
			billingState: orgSubscriptions.billingState
		})
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	if (rows.length === 0) {
		return { plan: 'free', billingState: 'none' }
	}

	return { plan: rows[0].plan, billingState: rows[0].billingState }
}

/**
 * Resolves whether an organisation has a specific entitlement.
 *
 * Resolution order:
 *   1. Determine effective plan (blocking billing states → free)
 *   2. Look up plan baseline
 *   3. Merge org-level overrides
 */
export async function hasEntitlement(
	organizationId: string,
	entitlementKey: EntitlementKey
): Promise<EntitlementDecision> {
	const db = getDbClient()

	const { plan, billingState } = await getOrgSubscription(organizationId)
	const effectivePlan = resolveEffectivePlan(plan, billingState)

	// Baseline from plan matrix
	const baseline = PLAN_ENTITLEMENTS[effectivePlan][entitlementKey]

	// Check for an org-level override for this specific key
	const [override] = await db
		.select({ granted: orgEntitlementOverrides.granted })
		.from(orgEntitlementOverrides)
		.where(
			and(
				eq(orgEntitlementOverrides.organizationId, organizationId),
				eq(orgEntitlementOverrides.entitlementKey, entitlementKey)
			)
		)
		.limit(1)

	const granted = override !== undefined ? override.granted : baseline
	const overridden = override !== undefined

	return { granted, effectivePlan, billingState, overridden }
}

/**
 * Resolves the numeric quota limit for a specific limit key.
 *
 * Resolution order:
 *   1. Determine effective plan
 *   2. Look up plan baseline limit
 *   3. Apply org-level override (if present)
 */
export async function getQuotaLimit(
	organizationId: string,
	limitKey: LimitKey
): Promise<QuotaDecision> {
	const db = getDbClient()

	const { plan, billingState } = await getOrgSubscription(organizationId)
	const effectivePlan = resolveEffectivePlan(plan, billingState)

	// Baseline from plan limits matrix
	const baseline = PLAN_LIMITS[effectivePlan][limitKey]

	// Check for an org-level override for this specific key
	const [override] = await db
		.select({ limitValue: orgLimitOverrides.limitValue })
		.from(orgLimitOverrides)
		.where(
			and(
				eq(orgLimitOverrides.organizationId, organizationId),
				eq(orgLimitOverrides.limitKey, limitKey)
			)
		)
		.limit(1)

	if (override !== undefined) {
		return { limit: override.limitValue, overridden: true, effectivePlan }
	}

	return { limit: baseline, overridden: false, effectivePlan }
}

/**
 * Returns the recommended upgrade path from the current effective plan.
 * Returns null when already on enterprise.
 */
export function getRecommendedUpgrade(currentPlan: Plan): Plan | null {
	const upgradePath: Record<Plan, Plan | null> = {
		free: 'pro',
		pro: 'business',
		business: 'enterprise',
		enterprise: null
	}
	return upgradePath[currentPlan]
}

