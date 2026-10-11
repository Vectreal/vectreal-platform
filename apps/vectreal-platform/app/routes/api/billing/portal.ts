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

import { Route } from './+types/portal'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getOrgStripeIds } from '../../../lib/domain/billing/stripe-subscription-sync.server'
import { canPerformDashboardOperation } from '../../../lib/domain/dashboard/dashboard-operations'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'
import { ensureSameOriginMutation } from '../../../lib/http/csrf.server'
import { getStripeClient } from '../../../lib/stripe.server'

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

	const organizationId = userWithDefaults.organization.id

	// Validate membership role
	const memberships = await getUserOrganizations(user.id)
	const membership = memberships.find(
		(m) => m.organization.id === organizationId
	)

	if (
		!membership ||
		!canPerformDashboardOperation('billing:manage', {
			role: membership.membership.role
		})
	) {
		return ApiResponse.forbidden(
			'Only organization owners and admins can access the billing portal',
			{ headers: responseHeaders }
		)
	}

	// Fetch the Stripe customer ID - required for portal access
	const sub = await getOrgStripeIds(organizationId)

	if (!sub?.stripeCustomerId) {
		return ApiResponse.error(
			'No billing account found for this organization. Please complete a checkout first.',
			400,
			{ headers: responseHeaders }
		)
	}

	const stripe = getStripeClient()

	const requestUrl = new URL(request.url)
	const returnUrl = `${requestUrl.protocol}//${requestUrl.host}/dashboard/billing`

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
