/**
 * Stripe subscription drift reconciliation service.
 *
 * Compares the local `org_subscriptions` table against Stripe as the source
 * of truth and corrects any divergences.
 *
 * Use cases:
 *   - Missed / failed webhook deliveries.
 *   - Manual database corrections that fell out of sync.
 *   - Periodic scheduled job to guarantee consistency.
 *
 * Algorithm:
 *   For each local row that has a `stripe_subscription_id`:
 *     1. Fetch the current subscription from Stripe.
 *     2. Compare `billing_state` and `plan`.
 *     3. If they differ, record a drift entry and (optionally) repair.
 *
 * The function returns a `ReconciliationReport` whether or not repairs were
 * applied — callers can inspect the report and decide whether to alert.
 */

import { isNotNull } from 'drizzle-orm'
import type Stripe from 'stripe'

import { type BillingState, type Plan } from '../../../constants/plan-config'
import { getDbClient } from '../../../db/client'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { getStripeClient } from '../../stripe.server'
import {
	mapStripeStatusToBillingState,
	resolvePlanFromSubscription,
	syncSubscriptionFromStripe
} from './stripe-subscription-sync.server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriftEntry {
	organizationId: string
	stripeSubscriptionId: string
	/** Billing state currently stored in the local DB. */
	localBillingState: BillingState
	/** Billing state reflected by the current Stripe subscription status. */
	stripeBillingState: BillingState
	/** Plan currently stored in the local DB. */
	localPlan: Plan
	/** Plan resolved from Stripe subscription / price metadata. */
	stripePlan: Plan
	/** True when the row has been corrected during this run. */
	repaired: boolean
}

export interface ReconciliationReport {
	/** Total number of local subscription rows examined. */
	totalExamined: number
	/** Number of rows that were in sync. */
	inSync: number
	/** Number of rows where drift was detected. */
	driftDetected: number
	/** Number of rows that were repaired (only non-zero when `repair = true`). */
	repaired: number
	/** Detailed drift entries. */
	driftEntries: DriftEntry[]
	/** Errors encountered during the run (non-fatal). */
	errors: Array<{ organizationId: string; message: string }>
}

export interface ReconcileOptions {
	/**
	 * When `true`, drift is corrected by re-syncing from Stripe.
	 * When `false` (default), the report is produced but no writes occur.
	 */
	repair?: boolean
	/**
	 * Maximum number of subscriptions to process in a single run.
	 * Defaults to 500.  Increase with caution; each subscription requires a
	 * Stripe API call.
	 */
	limit?: number
}

// ---------------------------------------------------------------------------
// Core reconciliation logic
// ---------------------------------------------------------------------------

/**
 * Runs the drift reconciliation against all local subscription rows that have
 * a Stripe subscription ID.
 *
 * @param options - See `ReconcileOptions`.
 * @returns A `ReconciliationReport` describing what was found and repaired.
 */
export async function reconcileStripeSubscriptions(
	options: ReconcileOptions = {}
): Promise<ReconciliationReport> {
	const { repair = false, limit = 500 } = options
	const stripe = getStripeClient()
	const db = getDbClient()

	const report: ReconciliationReport = {
		totalExamined: 0,
		inSync: 0,
		driftDetected: 0,
		repaired: 0,
		driftEntries: [],
		errors: []
	}

	// Fetch all local rows with a Stripe subscription ID
	const rows = await db
		.select({
			organizationId: orgSubscriptions.organizationId,
			stripeSubscriptionId: orgSubscriptions.stripeSubscriptionId,
			stripeCustomerId: orgSubscriptions.stripeCustomerId,
			localBillingState: orgSubscriptions.billingState,
			localPlan: orgSubscriptions.plan
		})
		.from(orgSubscriptions)
		.where(isNotNull(orgSubscriptions.stripeSubscriptionId))
		.limit(limit)

	report.totalExamined = rows.length

	for (const row of rows) {
		const { organizationId, stripeSubscriptionId, stripeCustomerId } = row

		if (!stripeSubscriptionId) continue

		let stripeSub: Stripe.Subscription

		try {
			stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
				expand: ['items.data.price.product']
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			report.errors.push({ organizationId, message })
			continue
		}

		const stripeBillingState = mapStripeStatusToBillingState(stripeSub.status)
		const stripePlan = resolvePlanFromSubscription(stripeSub, row.localPlan)

		const hasDrift =
			row.localBillingState !== stripeBillingState ||
			row.localPlan !== stripePlan

		if (!hasDrift) {
			report.inSync++
			continue
		}

		report.driftDetected++

		const entry: DriftEntry = {
			organizationId,
			stripeSubscriptionId,
			localBillingState: row.localBillingState,
			stripeBillingState,
			localPlan: row.localPlan,
			stripePlan,
			repaired: false
		}

		if (repair) {
			try {
				const resolvedCustomerId =
					stripeCustomerId ??
					(typeof stripeSub.customer === 'string'
						? stripeSub.customer
						: stripeSub.customer.id)

				await syncSubscriptionFromStripe({
					organizationId,
					stripeCustomerId: resolvedCustomerId,
					subscription: stripeSub
				})
				entry.repaired = true
				report.repaired++
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				report.errors.push({ organizationId, message })
			}
		}

		report.driftEntries.push(entry)
	}

	return report
}
