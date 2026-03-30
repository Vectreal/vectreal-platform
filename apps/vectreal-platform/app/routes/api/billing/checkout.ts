/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the requesting organisation.
 *
 * Request body (JSON):
 *   {
 *     planId: 'pro' | 'business',  // target plan
 *     priceId: string,             // Stripe Price ID for the selected plan/period
 *     billingPeriod: 'monthly' | 'annual'
 *   }
 *
 * Response (201):
 *   {
 *     checkoutUrl: string   // Stripe-hosted checkout URL; redirect the client here
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
import Stripe from 'stripe'

import { Route } from './+types/checkout'
import { getDbClient } from '../../../db/client'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'
import { ensureSameOriginMutation } from '../../../lib/http/csrf.server'
import { getStripeClient } from '../../../lib/stripe.server'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_PLANS: ReadonlySet<string> = new Set(['pro', 'business'])
const ALLOWED_BILLING_PERIODS: ReadonlySet<string> = new Set([
	'monthly',
	'annual'
])

function isStripeProduct(
	product: Stripe.Price['product']
): product is Stripe.Product {
	return (
		typeof product === 'object' &&
		product !== null &&
		!('deleted' in product && product.deleted === true)
	)
}

function getBillingPeriod(price: Stripe.Price): 'monthly' | 'annual' | null {
	if (!price.recurring) {
		return null
	}

	if (
		price.recurring.interval === 'month' &&
		price.recurring.interval_count === 1
	) {
		return 'monthly'
	}

	if (
		price.recurring.interval === 'year' &&
		price.recurring.interval_count === 1
	) {
		return 'annual'
	}

	return null
}

function resolvePlanFromPrice(price: Stripe.Price): string | null {
	const metadataPlan = price.metadata?.vectreal_plan
	if (typeof metadataPlan === 'string' && ALLOWED_PLANS.has(metadataPlan)) {
		return metadataPlan
	}

	if (
		isStripeProduct(price.product) &&
		typeof price.product.metadata.vectreal_plan === 'string' &&
		ALLOWED_PLANS.has(price.product.metadata.vectreal_plan)
	) {
		return price.product.metadata.vectreal_plan
	}

	return null
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs): Promise<Response> {
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

	let body: { planId?: unknown; priceId?: unknown; billingPeriod?: unknown }

	try {
		body = (await request.json()) as typeof body
	} catch {
		return ApiResponse.badRequest('Invalid JSON body')
	}

	const { planId, priceId, billingPeriod } = body

	// Validate inputs
	if (typeof planId !== 'string' || !ALLOWED_PLANS.has(planId)) {
		return ApiResponse.badRequest(
			`planId must be one of: ${[...ALLOWED_PLANS].join(', ')}`
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

	// Resolve organization — the user's primary (first-joined) organization
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

	// Fetch existing subscription to determine the current Stripe customer ID
	const db = getDbClient()
	const [existingSub] = await db
		.select({
			stripeCustomerId: orgSubscriptions.stripeCustomerId
		})
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

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

	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		customer: existingSub?.stripeCustomerId ?? undefined,
		customer_email: existingSub?.stripeCustomerId
			? undefined
			: (user.email ?? undefined),
		line_items: [{ price: priceId, quantity: 1 }],
		success_url: `${baseUrl}/dashboard/billing/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${baseUrl}/dashboard/billing/checkout-canceled`,
		metadata: {
			organization_id: organizationId,
			plan_id: planId,
			billing_period: billingPeriod
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
		{ checkoutUrl: session.url },
		{ headers: responseHeaders }
	)
}
