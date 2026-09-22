/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the requesting organisation.
 *
 * Request body (JSON):
 *   {
 *     planId: PaidPlan,           // target plan
 *     priceId: string,             // Stripe Price ID for the selected plan/period
 *     billingPeriod: 'monthly' | 'annual'
 *   }
 *
 * Response (201):
 *   {
 *     redirectUrl: string   // Redirect the client here.
 *                           // For new subscribers: Stripe-hosted checkout page.
 *                           // For existing subscribers: success page (subscription updated in-place).
 *   }
 *
 * Security:
 *   - Requires authenticated session (Supabase JWT).
 *   - Validates organisation membership (owner or admin only).
 *   - Success / cancel URLs are constructed server-side; no client-supplied
 *     redirect URL is accepted to prevent open-redirect attacks.
 *   - Organization ID is stored in checkout session metadata so the webhook
 *     handler can reliably resolve it without relying on Stripe customer lookup.
 */

import { ApiResponse } from '@shared/utils'
import { eq } from 'drizzle-orm'

import { Route } from './+types/checkout'
import { isPaidPlan, PURCHASABLE_PLANS } from '../../../constants/plan-config'
import { getDbClient } from '../../../db/client'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { planChangeAppliesImmediately } from '../../../lib/domain/billing/billing-situation'
import {
	CHECKOUT_GATE_DENIAL,
	resolveCheckoutGate
} from '../../../lib/domain/billing/checkout-kill-switch'
import { getOrgSubscription } from '../../../lib/domain/billing/entitlement-service.server'
import {
	getBillingPeriod,
	resolvePlanFromPrice
} from '../../../lib/domain/billing/stripe-price-plan'
import { syncSubscriptionFromStripe } from '../../../lib/domain/billing/stripe-subscription-sync.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'
import { ensureSameOriginMutation } from '../../../lib/http/csrf.server'
import { reportServerError } from '../../../lib/observability/report-server-error.server'
import { getStripeClient } from '../../../lib/stripe.server'

import type { PostHogContext } from '../../../lib/posthog/posthog-middleware'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_BILLING_PERIODS: ReadonlySet<string> = new Set([
	'monthly',
	'annual'
])

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({
	request,
	context
}: Route.ActionArgs): Promise<Response> {
	if (request.method !== 'POST') {
		return ApiResponse.methodNotAllowed()
	}

	const csrfCheck = ensureSameOriginMutation(request)
	if (csrfCheck) {
		return csrfCheck
	}

	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)
	const responseHeaders = new Headers(headers)

	/*
	  The kill switch, which now denies when it cannot be read rather than
	  skipping itself. See `checkout-kill-switch.ts` for why the old
	  `if (posthog)` meant checkout was never gated in production at all.
	*/
	const gate = await resolveCheckoutGate(
		(context as PostHogContext).posthog,
		user.id
	)
	if (!gate.allowed) {
		/*
		  Only the misconfigured case is reported. `not_enabled` is the expected
		  state while checkout is deliberately held shut, so reporting it would
		  file one exception per attempt; `unconfigured` means this deployment
		  lost its PostHog secrets and every checkout is now failing, which is
		  the outage nobody noticed last time. A returned response never reaches
		  `handleError`, so without this the sink sees nothing either way.
		*/
		if (gate.reason === 'unconfigured') {
			reportServerError(
				new Error(
					'Checkout refused: the billing-checkout kill switch cannot be evaluated because PostHog is not configured on this deployment.'
				),
				{ request, properties: { userId: user.id } }
			)
		}

		const denial = CHECKOUT_GATE_DENIAL[gate.reason]
		return ApiResponse.error(denial.message, denial.status, {
			headers: responseHeaders
		})
	}

	let body: { planId?: unknown; priceId?: unknown; billingPeriod?: unknown }

	try {
		body = (await request.json()) as typeof body
	} catch {
		return ApiResponse.badRequest('Invalid JSON body')
	}

	const { planId, priceId, billingPeriod } = body

	// Validate inputs
	if (!isPaidPlan(planId)) {
		return ApiResponse.badRequest(
			`planId must be one of: ${PURCHASABLE_PLANS.join(', ')}`
		)
	}

	if (typeof priceId !== 'string' || !priceId.startsWith('price_')) {
		return ApiResponse.badRequest(
			'priceId must be a valid Stripe Price ID (starts with "price_")'
		)
	}

	if (
		typeof billingPeriod !== 'string' ||
		!ALLOWED_BILLING_PERIODS.has(billingPeriod)
	) {
		return ApiResponse.badRequest(
			`billingPeriod must be one of: ${[...ALLOWED_BILLING_PERIODS].join(', ')}`
		)
	}

	// Resolve organization - the user's primary (first-joined) organization
	const organizationId = userWithDefaults.organization.id

	// Validate the user is an owner or admin of the organization
	const memberships = await getUserOrganizations(user.id)
	const membership = memberships.find(
		(m) => m.organization.id === organizationId
	)

	if (!membership || !['owner', 'admin'].includes(membership.membership.role)) {
		return ApiResponse.forbidden(
			'Only organization owners and admins can manage billing',
			{ headers: responseHeaders }
		)
	}

	// Fetch existing subscription to determine the current Stripe customer ID and current plan
	const db = getDbClient()
	const [existingSub] = await db
		.select({
			stripeCustomerId: orgSubscriptions.stripeCustomerId,
			stripeSubscriptionId: orgSubscriptions.stripeSubscriptionId
		})
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	const { plan: currentPlan, billingState } =
		await getOrgSubscription(organizationId)

	/*
	  An enterprise organization cannot buy its way down from here.

	  Its plan is a contract, and it carries no Stripe subscription, so this
	  route would have taken the hosted-checkout branch and opened a SECOND
	  subscription beside the one that is invoiced off-platform. Checkout
	  validated only that the requested plan was purchasable, never against the
	  plan already held, so the page's offer was the only thing keeping this
	  shut - and a page is not a guard.
	*/
	if (currentPlan === 'enterprise') {
		return ApiResponse.badRequest(
			'Enterprise plans are changed by talking to us, not through checkout'
		)
	}

	const stripe = getStripeClient()
	const selectedPrice = await stripe.prices.retrieve(priceId, {
		expand: ['product']
	})

	if (!selectedPrice.active) {
		return ApiResponse.badRequest('Selected Stripe price is not active')
	}

	const resolvedPlan = resolvePlanFromPrice(selectedPrice)
	if (resolvedPlan !== planId) {
		return ApiResponse.badRequest(
			'Selected Stripe price does not match the requested plan'
		)
	}

	const resolvedBillingPeriod = getBillingPeriod(selectedPrice)
	if (resolvedBillingPeriod !== billingPeriod) {
		return ApiResponse.badRequest(
			'Selected Stripe price does not match the requested billing period'
		)
	}

	// Build the absolute base URL from the incoming request
	const requestUrl = new URL(request.url)
	const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`

	// Route decision: update the existing subscription in-place when the org
	// already has an active subscription. This avoids creating a second Stripe
	// subscription (which would cause double-billing) and enables proration.
	// Only `active` qualifies - past_due / trialing / etc. fall through to
	// the hosted Checkout flow where payment details can be re-entered.
	const isActiveSub = planChangeAppliesImmediately({
		billingState,
		stripeSubscriptionId: existingSub?.stripeSubscriptionId ?? null,
		stripeCustomerId: existingSub?.stripeCustomerId ?? null
	})

	if (isActiveSub) {
		// Retrieve the existing subscription - needed only for the item ID.
		const existingSubscription = await stripe.subscriptions.retrieve(
			existingSub.stripeSubscriptionId!
		)
		const itemId = existingSubscription.items.data[0]?.id
		if (!itemId) {
			return ApiResponse.serverError('Existing subscription has no items')
		}

		// Swap price in-place. Expand price+product so syncSubscriptionFromStripe
		// can resolve the plan via metadata without a second round-trip.
		const updatedSubscription = await stripe.subscriptions.update(
			existingSub.stripeSubscriptionId!,
			{
				items: [{ id: itemId, price: priceId }],
				proration_behavior: 'create_prorations',
				expand: ['items.data.price.product']
			}
		)

		// Sync DB immediately - the success page needs no further Stripe call.
		await syncSubscriptionFromStripe({
			organizationId,
			stripeCustomerId: existingSub.stripeCustomerId!,
			subscription: updatedSubscription
		})

		const redirectUrl =
			`${baseUrl}/dashboard/billing/upgrade-success` +
			`?plan_id=${planId}&billing_period=${billingPeriod}&from_plan=${currentPlan}`

		console.info('[billing/checkout] updated existing subscription', {
			subscriptionId: existingSub.stripeSubscriptionId,
			organizationId,
			planId,
			billingPeriod
		})

		return ApiResponse.created({ redirectUrl }, { headers: responseHeaders })
	}

	// New subscription - use Stripe-hosted Checkout.
	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		customer: existingSub?.stripeCustomerId ?? undefined,
		customer_email: existingSub?.stripeCustomerId
			? undefined
			: (user.email ?? undefined),
		line_items: [{ price: priceId, quantity: 1 }],
		success_url: `${baseUrl}/dashboard/billing/upgrade-success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${baseUrl}/dashboard/billing/upgrade-canceled?plan=${planId}`,
		metadata: {
			organization_id: organizationId,
			plan_id: planId,
			billing_period: billingPeriod,
			from_plan: currentPlan
		},
		subscription_data: {
			metadata: {
				organization_id: organizationId
			}
		},
		allow_promotion_codes: true
	})

	if (!session.url) {
		return ApiResponse.serverError('Failed to create checkout session')
	}

	console.info('[billing/checkout] created checkout session', {
		sessionId: session.id,
		organizationId,
		planId,
		billingPeriod
	})

	return ApiResponse.created(
		{ redirectUrl: session.url },
		{ headers: responseHeaders }
	)
}
