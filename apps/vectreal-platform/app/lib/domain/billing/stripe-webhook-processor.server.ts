/**
 * Stripe webhook event processor.
 *
 * Implements idempotent, resilient processing for the Stripe events listed in
 * prd/04-billing-states.md §Webhook Events.
 *
 * Processing contract:
 *   1. Verify Stripe signature before touching the database.
 *   2. Register the event in `billing_webhook_events` (status = pending).
 *      If a row with the same (provider, providerEventId) already exists the
 *      event has already been seen — return early to prevent duplicate work.
 *   3. Dispatch to the appropriate handler based on event type.
 *   4. On success mark the row as `processed`; on failure mark it `failed`
 *      and store the error message so operators can replay.
 *
 * Supported events and resulting state transitions:
 *   checkout.session.completed        → sync full subscription (active/trialing)
 *   customer.subscription.updated     → sync full subscription
 *   invoice.payment_succeeded         → billingState = active
 *   invoice.payment_failed            → billingState = past_due
 *   customer.subscription.deleted     → billingState = canceled
 *   customer.subscription.paused      → billingState = paused
 *   customer.subscription.resumed     → billingState = active
 *   customer.subscription.trial_will_end → notification only (no state change)
 */

import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

import { getDbClient } from '../../../db/client'
import { billingWebhookEvents } from '../../../db/schema/billing/webhook-events'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { getStripeClient, resolveStripeWebhookSecret } from '../../stripe.server'
import {
	cancelSubscription,
	findOrganizationByCustomerId,
	findOrganizationBySubscriptionId,
	syncSubscriptionFromStripe
} from './stripe-subscription-sync.server'

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verifies the Stripe-Signature header and returns the parsed event.
 * Throws when the signature is invalid or the payload is malformed.
 */
export function constructStripeEvent(
	rawBody: string,
	signatureHeader: string
): Stripe.Event {
	const webhookSecret = resolveStripeWebhookSecret()
	const stripe = getStripeClient()

	return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret)
}

// ---------------------------------------------------------------------------
// Idempotency guard
// ---------------------------------------------------------------------------

type EventRegistrationResult =
	| { alreadySeen: true }
	| { alreadySeen: false; rowId: string }

/**
 * Attempts to register the event in the idempotency table.
 * Returns `{ alreadySeen: true }` when the event was already registered so
 * the caller can short-circuit.
 */
async function registerEvent(
	event: Stripe.Event
): Promise<EventRegistrationResult> {
	const db = getDbClient()

	// Attempt to insert; the unique index on (provider, provider_event_id)
	// will cause a conflict when the event has already been seen.
	const [inserted] = await db
		.insert(billingWebhookEvents)
		.values({
			provider: 'stripe',
			providerEventId: event.id,
			eventType: event.type,
			status: 'pending',
			payload: event as unknown as Record<string, unknown>
		})
		.onConflictDoNothing({
			target: [
				billingWebhookEvents.provider,
				billingWebhookEvents.providerEventId
			]
		})
		.returning({ id: billingWebhookEvents.id })

	if (!inserted) {
		return { alreadySeen: true }
	}

	return { alreadySeen: false, rowId: inserted.id }
}

async function markProcessed(rowId: string): Promise<void> {
	const db = getDbClient()
	await db
		.update(billingWebhookEvents)
		.set({ status: 'processed', processedAt: new Date() })
		.where(eq(billingWebhookEvents.id, rowId))
}

async function markFailed(rowId: string, errorMessage: string): Promise<void> {
	const db = getDbClient()
	await db
		.update(billingWebhookEvents)
		.set({ status: 'failed', errorMessage })
		.where(eq(billingWebhookEvents.id, rowId))
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutSessionCompleted(
	session: Stripe.Checkout.Session
): Promise<void> {
	if (session.mode !== 'subscription' || !session.subscription) {
		return
	}

	const stripe = getStripeClient()
	const subscriptionId =
		typeof session.subscription === 'string'
			? session.subscription
			: session.subscription.id

	// Fetch the full subscription object so we can resolve the plan from metadata
	const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
		expand: ['items.data.price.product']
	})

	const customerId =
		typeof session.customer === 'string'
			? session.customer
			: (session.customer?.id ?? '')

	// The checkout session carries the organization ID in its metadata
	const organizationId =
		session.metadata?.organization_id ??
		(await findOrganizationByCustomerId(customerId))

	if (!organizationId) {
		throw new Error(
			`Cannot resolve organization for Stripe customer ${customerId}`
		)
	}

	await syncSubscriptionFromStripe({
		organizationId,
		stripeCustomerId: customerId,
		subscription
	})
}

async function handleSubscriptionUpdated(
	subscription: Stripe.Subscription
): Promise<void> {
	const stripe = getStripeClient()

	// Re-fetch with expanded product so plan metadata is available
	const expanded = await stripe.subscriptions.retrieve(subscription.id, {
		expand: ['items.data.price.product']
	})

	const customerId =
		typeof expanded.customer === 'string'
			? expanded.customer
			: expanded.customer.id

	const organizationId = await findOrganizationByCustomerId(customerId)

	if (!organizationId) {
		throw new Error(
			`Cannot resolve organization for Stripe customer ${customerId}`
		)
	}

	await syncSubscriptionFromStripe({
		organizationId,
		stripeCustomerId: customerId,
		subscription: expanded
	})
}

async function handleSubscriptionDeleted(
	subscription: Stripe.Subscription
): Promise<void> {
	await cancelSubscription(subscription.id)
}

async function handleInvoicePaymentSucceeded(
	invoice: Stripe.Invoice
): Promise<void> {
	const db = getDbClient()
	const subscriptionId =
		typeof invoice.subscription === 'string'
			? invoice.subscription
			: invoice.subscription?.id

	if (!subscriptionId) return

	const organizationId = await findOrganizationBySubscriptionId(subscriptionId)
	if (!organizationId) {
		throw new Error(
			`Cannot resolve organization for Stripe subscription ${subscriptionId}`
		)
	}

	await db
		.update(orgSubscriptions)
		.set({ billingState: 'active', updatedAt: new Date() })
		.where(eq(orgSubscriptions.organizationId, organizationId))
}

async function handleInvoicePaymentFailed(
	invoice: Stripe.Invoice
): Promise<void> {
	const db = getDbClient()
	const subscriptionId =
		typeof invoice.subscription === 'string'
			? invoice.subscription
			: invoice.subscription?.id

	if (!subscriptionId) return

	const organizationId = await findOrganizationBySubscriptionId(subscriptionId)
	if (!organizationId) {
		throw new Error(
			`Cannot resolve organization for Stripe subscription ${subscriptionId}`
		)
	}

	await db
		.update(orgSubscriptions)
		.set({ billingState: 'past_due', updatedAt: new Date() })
		.where(eq(orgSubscriptions.organizationId, organizationId))
}

async function handleSubscriptionPaused(
	subscription: Stripe.Subscription
): Promise<void> {
	const db = getDbClient()
	const customerId =
		typeof subscription.customer === 'string'
			? subscription.customer
			: subscription.customer.id

	const organizationId = await findOrganizationByCustomerId(customerId)
	if (!organizationId) {
		throw new Error(
			`Cannot resolve organization for Stripe customer ${customerId}`
		)
	}

	await db
		.update(orgSubscriptions)
		.set({ billingState: 'paused', updatedAt: new Date() })
		.where(eq(orgSubscriptions.organizationId, organizationId))
}

async function handleSubscriptionResumed(
	subscription: Stripe.Subscription
): Promise<void> {
	const db = getDbClient()
	const customerId =
		typeof subscription.customer === 'string'
			? subscription.customer
			: subscription.customer.id

	const organizationId = await findOrganizationByCustomerId(customerId)
	if (!organizationId) {
		throw new Error(
			`Cannot resolve organization for Stripe customer ${customerId}`
		)
	}

	await db
		.update(orgSubscriptions)
		.set({ billingState: 'active', updatedAt: new Date() })
		.where(eq(orgSubscriptions.organizationId, organizationId))
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatches a verified Stripe event to the appropriate handler.
 * Returns the event type string for logging.
 */
async function dispatchEvent(event: Stripe.Event): Promise<void> {
	switch (event.type) {
		case 'checkout.session.completed':
			await handleCheckoutSessionCompleted(
				event.data.object as Stripe.Checkout.Session
			)
			break

		case 'customer.subscription.created':
		case 'customer.subscription.updated':
			await handleSubscriptionUpdated(
				event.data.object as Stripe.Subscription
			)
			break

		case 'customer.subscription.deleted':
			await handleSubscriptionDeleted(
				event.data.object as Stripe.Subscription
			)
			break

		case 'customer.subscription.paused':
			await handleSubscriptionPaused(
				event.data.object as Stripe.Subscription
			)
			break

		case 'customer.subscription.resumed':
			await handleSubscriptionResumed(
				event.data.object as Stripe.Subscription
			)
			break

		case 'invoice.payment_succeeded':
			await handleInvoicePaymentSucceeded(
				event.data.object as Stripe.Invoice
			)
			break

		case 'invoice.payment_failed':
			await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
			break

		case 'customer.subscription.trial_will_end':
			// Notification only — no state change.
			// Log at debug level for observability; no DB write required.
			console.debug(
				`[stripe-webhook] trial_will_end for subscription ${(event.data.object as Stripe.Subscription).id}`
			)
			break

		default:
			// Unknown event types are acknowledged (200 OK) but not processed.
			console.debug(`[stripe-webhook] unhandled event type: ${event.type}`)
	}
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface WebhookProcessResult {
	/** Whether the event was already processed (idempotency short-circuit). */
	duplicate: boolean
	/** The Stripe event type string (useful for response logging). */
	eventType: string
}

/**
 * Full webhook processing pipeline:
 *   1. Register event (idempotency check)
 *   2. Dispatch to handler
 *   3. Mark processed / failed
 *
 * Callers must have already called `constructStripeEvent` to verify the
 * signature before passing the event here.
 */
export async function processStripeWebhookEvent(
	event: Stripe.Event
): Promise<WebhookProcessResult> {
	const registration = await registerEvent(event)

	if (registration.alreadySeen) {
		return { duplicate: true, eventType: event.type }
	}

	const { rowId } = registration

	try {
		await dispatchEvent(event)
		await markProcessed(rowId)
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		await markFailed(rowId, message)
		throw err
	}

	return { duplicate: false, eventType: event.type }
}
