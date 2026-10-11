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
 *   - State mapping is defined by BillingState in app/constants/plan-config.ts.
 *   - All writes are upserts so the function is safe to call repeatedly
 *     (idempotent at the record level).
 */

import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

import { resolvePlanMetadata } from './stripe-price-plan'
import {
	isPlan,
	type BillingState,
	type Plan
} from '../../../constants/plan-config'
import { getDbClient } from '../../../db/client'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { reportServerError } from '../../observability/report-server-error.server'
import { getStripeClient } from '../../stripe.server'

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
function firstPrice(
	subscription: Stripe.Subscription
): Stripe.Price | undefined {
	return (
		(subscription.items?.data?.[0]?.price as Stripe.Price | undefined) ??
		undefined
	)
}

export function resolvePlanFromSubscription(
	subscription: Stripe.Subscription,
	fallbackPlan: Plan = 'free'
): Plan {
	const price = firstPrice(subscription)
	if (!price) return fallbackPlan

	/*
	  The search belongs to `stripe-price-plan`; only the acceptance rule is
	  this module's. It records the plan an organization is actually on, so it
	  takes any `Plan` - `free` and `enterprise` included - where checkout takes
	  only the two it can sell.

	  This used to be a third copy of that search, and reached the product
	  through `typeof product !== 'string'` and a cast. A deleted product is an
	  object, so it passed both and was read as a live one; nothing but the
	  optional chain on `.metadata` stopped it throwing inside the webhook.
	*/
	return resolvePlanMetadata(price, isPlan) ?? fallbackPlan
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
	const firstSubscriptionItem = subscription.items.data[0]

	const currentPeriodEnd =
		firstSubscriptionItem &&
		typeof firstSubscriptionItem.current_period_end === 'number'
			? new Date(firstSubscriptionItem.current_period_end * 1000)
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

// ---------------------------------------------------------------------------
// Account deletion helper
// ---------------------------------------------------------------------------

/**
 * Cancels the active Stripe subscription for an organisation as part of
 * account deletion.
 *
 * This must be called **before** the user / organisation DB row is deleted,
 * because the cascade will wipe `org_subscriptions` (losing the Stripe IDs)
 * without ever instructing Stripe to stop billing the customer's card.
 *
 * Error handling: Stripe errors are caught and logged but do NOT propagate -
 * account deletion must not be blocked by a transient Stripe outage.
 * Orphaned subscriptions can be identified and cleaned up via the
 * `/api/billing/reconcile` endpoint.
 */
export async function cancelStripeSubscriptionsForOrganization(
	organizationId: string
): Promise<void> {
	const db = getDbClient()

	const [row] = await db
		.select({ stripeSubscriptionId: orgSubscriptions.stripeSubscriptionId })
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	if (!row?.stripeSubscriptionId) {
		// No paid subscription recorded - nothing to cancel in Stripe.
		return
	}

	const stripe = getStripeClient()

	try {
		await stripe.subscriptions.cancel(row.stripeSubscriptionId)
		console.info(
			'[billing] Stripe subscription cancelled on account deletion',
			{ organizationId, stripeSubscriptionId: row.stripeSubscriptionId }
		)
	} catch (err) {
		/*
		  Non-blocking, and it needs a human: the account is gone while the Stripe
		  subscription keeps billing. This used to say "log the failure so
		  operators can reconcile manually" into a stream with no alerting on it,
		  which meant no operator was ever told.
		*/
		reportServerError(err, {
			properties: {
				organizationId,
				stripeSubscriptionId: row.stripeSubscriptionId
			}
		})
	}
}

/**
 * The Stripe ids recorded for an organization, or `undefined` when it has no
 * subscription row yet. Checkout needs both, the billing portal the customer,
 * and a completed checkout the subscription it is about to replace.
 */
export async function getOrgStripeIds(organizationId: string): Promise<
	| {
			stripeCustomerId: string | null
			stripeSubscriptionId: string | null
	  }
	| undefined
> {
	const db = getDbClient()

	const [row] = await db
		.select({
			stripeCustomerId: orgSubscriptions.stripeCustomerId,
			stripeSubscriptionId: orgSubscriptions.stripeSubscriptionId
		})
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	return row
}

export interface CheckoutData {
	planId: string | null
	billingPeriod: string | null
	fromPlan: string | null
	/** True when the subscription was updated in-place (no Stripe Checkout
	 *  redirect) - the DB is already synced before the user lands here. */
	isDirectUpdate: boolean
}

/**
 * Retrieves the Stripe checkout session, verifies it belongs to the given org,
 * syncs the new subscription to the DB, and cancels any prior subscription that
 * was replaced - preventing double-billing on plan/price switches.
 */
export async function syncCompletedCheckout(
	sessionId: string,
	organizationId: string
): Promise<CheckoutData> {
	const stripe = getStripeClient()
	const session = await stripe.checkout.sessions.retrieve(sessionId, {
		expand: ['subscription']
	})

	const base: CheckoutData = {
		planId: session.metadata?.plan_id ?? null,
		billingPeriod: session.metadata?.billing_period ?? null,
		fromPlan: session.metadata?.from_plan ?? null,
		isDirectUpdate: false
	}

	// Security: reject sessions not issued for this org
	if (session.metadata?.organization_id !== organizationId) {
		return base
	}

	const isPaymentSettled =
		session.payment_status === 'paid' ||
		session.payment_status === 'no_payment_required'

	const subscription = session.subscription
	const isEligibleForSync =
		session.status === 'complete' &&
		isPaymentSettled &&
		session.mode === 'subscription' &&
		subscription != null &&
		typeof subscription !== 'string'

	if (!isEligibleForSync || typeof subscription === 'string') return base

	const customerId =
		typeof session.customer === 'string'
			? session.customer
			: (session.customer?.id ?? null)

	if (!customerId) return base

	// Capture the existing subscription ID before syncing overwrites it.
	// This is necessary to cancel the old subscription when the user switched
	// plans or billing period - Stripe creates a new subscription rather than
	// updating the existing one, so we must cancel the old one explicitly to
	// avoid double-billing.
	const existing = await getOrgStripeIds(organizationId)
	const oldSubscriptionId = existing?.stripeSubscriptionId ?? null

	// Retrieve the full subscription with price+product expanded so that
	// resolvePlanFromSubscription can read metadata (Stripe caps expansion at 4 levels).
	const expandedSubscription = await stripe.subscriptions.retrieve(
		subscription.id,
		{ expand: ['items.data.price.product'] }
	)

	await syncSubscriptionFromStripe({
		organizationId,
		stripeCustomerId: customerId,
		subscription: expandedSubscription
	})

	// Cancel the replaced subscription so the customer is not charged twice.
	// This safety net applies to edge cases where a second subscription was
	// created despite the direct-update path (e.g. stale DB state).
	if (oldSubscriptionId && oldSubscriptionId !== subscription.id) {
		try {
			await stripe.subscriptions.cancel(oldSubscriptionId)
		} catch (err) {
			/*
			  The customer now holds two live Stripe subscriptions and is billed
			  for both. No request in scope here - this runs from a helper - so
			  the report carries the ids instead.
			*/
			reportServerError(err, {
				properties: {
					oldSubscriptionId,
					newSubscriptionId: subscription.id
				}
			})
		}
	}

	return base
}
