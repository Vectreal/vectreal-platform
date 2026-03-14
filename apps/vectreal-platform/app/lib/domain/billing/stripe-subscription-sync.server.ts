/**
 * Stripe subscription synchronisation service.
 *
 * Provides a single, authoritative write-path for updating the local
 * `org_subscriptions` table from Stripe subscription data.  All webhook
 * handlers and the reconciliation command delegate to these helpers so that
 * the mapping logic lives in one place.
 *
 * Design notes:
 *   - The canonical plan is derived from the Stripe price's metadata field
 *     `vectreal_plan` (e.g., `pro`).  If the metadata is absent the function
 *     falls back to the existing plan stored locally so that a misconfigured
 *     product does not silently downgrade a paying customer.
 *   - State mapping follows prd/04-billing-states.md §Webhook Events.
 *   - All writes are upserts so the function is safe to call repeatedly
 *     (idempotent at the record level).
 */

import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

import { type BillingState, type Plan } from '../../../constants/plan-config'
import { getDbClient } from '../../../db/client'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'

// ---------------------------------------------------------------------------
// Stripe status → local BillingState mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Stripe subscription status to the platform's canonical BillingState.
 * Stripe statuses not listed here are treated as `incomplete`.
 */
export function mapStripeStatusToBillingState(
	status: Stripe.Subscription['status']
): BillingState {
	const map: Record<string, BillingState> = {
		trialing: 'trialing',
		active: 'active',
		past_due: 'past_due',
		unpaid: 'unpaid',
		canceled: 'canceled',
		paused: 'paused',
		incomplete: 'incomplete',
		incomplete_expired: 'incomplete_expired'
	}
	return map[status] ?? 'incomplete'
}

// ---------------------------------------------------------------------------
// Plan resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the canonical plan identifier from a Stripe subscription.
 *
 * Resolution order:
 *   1. `vectreal_plan` metadata on the first subscription item's price.
 *   2. `vectreal_plan` metadata on the product attached to the price.
 *   3. Fall back to the provided `fallbackPlan` (existing DB value or `'free'`).
 */
export function resolvePlanFromSubscription(
	subscription: Stripe.Subscription,
	fallbackPlan: Plan = 'free'
): Plan {
	const VALID_PLANS: ReadonlySet<string> = new Set([
		'free',
		'pro',
		'business',
		'enterprise'
	])

	const firstItem = subscription.items?.data?.[0]
	if (!firstItem) return fallbackPlan

	// Check price metadata first
	const pricePlan = (firstItem.price as Stripe.Price | undefined)?.metadata
		?.vectreal_plan
	if (pricePlan && VALID_PLANS.has(pricePlan)) {
		return pricePlan as Plan
	}

	// Then check product metadata (product may be expanded or just an ID)
	const product = (firstItem.price as Stripe.Price | undefined)?.product
	if (product && typeof product !== 'string') {
		const productPlan = (product as Stripe.Product).metadata?.vectreal_plan
		if (productPlan && VALID_PLANS.has(productPlan)) {
			return productPlan as Plan
		}
	}

	return fallbackPlan
}

// ---------------------------------------------------------------------------
// Subscription upsert
// ---------------------------------------------------------------------------

export interface SyncSubscriptionParams {
	organizationId: string
	stripeCustomerId: string
	subscription: Stripe.Subscription
}

/**
 * Upserts the local subscription record to match the provided Stripe
 * subscription object.
 *
 * Returns the updated row.
 */
export async function syncSubscriptionFromStripe(
	params: SyncSubscriptionParams
): Promise<void> {
	const { organizationId, stripeCustomerId, subscription } = params
	const db = getDbClient()

	// Fetch existing row so we can fall back to the stored plan if needed
	const [existing] = await db
		.select({ plan: orgSubscriptions.plan })
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	const resolvedPlan = resolvePlanFromSubscription(
		subscription,
		existing?.plan ?? 'free'
	)

	const billingState = mapStripeStatusToBillingState(subscription.status)

	const currentPeriodEnd =
		typeof subscription.current_period_end === 'number'
			? new Date(subscription.current_period_end * 1000)
			: null

	const trialEnd =
		typeof subscription.trial_end === 'number'
			? new Date(subscription.trial_end * 1000)
			: null

	await db
		.insert(orgSubscriptions)
		.values({
			organizationId,
			stripeCustomerId,
			stripeSubscriptionId: subscription.id,
			plan: resolvedPlan,
			billingState,
			currentPeriodEnd,
			trialEnd
		})
		.onConflictDoUpdate({
			target: orgSubscriptions.organizationId,
			set: {
				stripeCustomerId,
				stripeSubscriptionId: subscription.id,
				plan: resolvedPlan,
				billingState,
				currentPeriodEnd,
				trialEnd,
				updatedAt: new Date()
			}
		})
}

// ---------------------------------------------------------------------------
// Cancel helper
// ---------------------------------------------------------------------------

/**
 * Sets billing state to `canceled` for the organisation whose subscription
 * matches the provided Stripe subscription ID.
 */
export async function cancelSubscription(
	stripeSubscriptionId: string
): Promise<void> {
	const db = getDbClient()

	await db
		.update(orgSubscriptions)
		.set({ billingState: 'canceled', updatedAt: new Date() })
		.where(eq(orgSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
}

// ---------------------------------------------------------------------------
// Customer ID lookup
// ---------------------------------------------------------------------------

/**
 * Finds the organization ID for a given Stripe customer ID.
 * Returns `null` when no matching subscription record is found.
 */
export async function findOrganizationByCustomerId(
	stripeCustomerId: string
): Promise<string | null> {
	const db = getDbClient()

	const [row] = await db
		.select({ organizationId: orgSubscriptions.organizationId })
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.stripeCustomerId, stripeCustomerId))
		.limit(1)

	return row?.organizationId ?? null
}

/**
 * Finds the organization ID for a given Stripe subscription ID.
 * Returns `null` when no matching subscription record is found.
 */
export async function findOrganizationBySubscriptionId(
	stripeSubscriptionId: string
): Promise<string | null> {
	const db = getDbClient()

	const [row] = await db
		.select({ organizationId: orgSubscriptions.organizationId })
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
		.limit(1)

	return row?.organizationId ?? null
}
