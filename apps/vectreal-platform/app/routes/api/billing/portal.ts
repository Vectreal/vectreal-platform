/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Billing Portal session for the requesting organisation and
 * returns the portal URL.  The client should redirect to this URL.
 *
 * Security:
 *   - Requires authenticated session (Supabase JWT).
 *   - The user must be an owner or admin of the organisation.
 *   - Return URL is constructed server-side to prevent open redirects.
 *   - Access is logged for audit purposes.
 */

import { ApiResponse } from '@shared/utils'
import { eq } from 'drizzle-orm'

import { Route } from './+types/portal'
import { getDbClient } from '../../../db/client'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'
import { getStripeClient } from '../../../lib/stripe.server'

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs): Promise<Response> {
	if (request.method !== 'POST') {
		return ApiResponse.methodNotAllowed()
	}

	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)
	const responseHeaders = new Headers(headers)

	const organizationId = userWithDefaults.organization.id

	// Validate membership role
	const memberships = await getUserOrganizations(user.id)
	const membership = memberships.find(
		(m) => m.organization.id === organizationId
	)

	if (!membership || !['owner', 'admin'].includes(membership.membership.role)) {
		return ApiResponse.forbidden(
			'Only organization owners and admins can access the billing portal',
			{ headers: responseHeaders }
		)
	}

	// Fetch the Stripe customer ID — required for portal access
	const db = getDbClient()
	const [sub] = await db
		.select({ stripeCustomerId: orgSubscriptions.stripeCustomerId })
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	if (!sub?.stripeCustomerId) {
		return ApiResponse.error(
			'No billing account found for this organization. Please complete a checkout first.',
			400,
			{ headers: responseHeaders }
		)
	}

	const stripe = getStripeClient()

	const requestUrl = new URL(request.url)
	const returnUrl = `${requestUrl.protocol}//${requestUrl.host}/dashboard`

	const portalSession = await stripe.billingPortal.sessions.create({
		customer: sub.stripeCustomerId,
		return_url: returnUrl
	})

	console.info('[billing/portal] created portal session', {
		organizationId,
		userId: user.id
	})

	return ApiResponse.created(
		{ portalUrl: portalSession.url },
		{ headers: responseHeaders }
	)
}
