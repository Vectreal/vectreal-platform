import { DASHBOARD_ROUTES } from '../../../constants/dashboard'
import { isBillingStateReadOnly } from '../../../constants/plan-config'
import { EntitlementRequiredError } from '../billing/entitlement-required-error'
import { QuotaExceededError } from '../billing/quota-exceeded-error'

import type { ApiErrorCode, ApiFailure } from '@vctrl/sdk'

/**
 * Every `/api/v1` refusal, in the one shape `@vctrl/sdk` reads: the envelope's
 * message plus a stable `code` an agent can branch on. A v1 route never calls
 * `ApiResponse.error`, whose body has no code.
 *
 * Pure, so the gate and its tests can build refusals without a database.
 */
export function agentApiError(
	status: number,
	code: ApiErrorCode,
	message: string,
	options: {
		headers?: Record<string, string>
		/** Fields beside the message, such as the `scope` a refusal names. */
		extra?: Record<string, unknown>
	} = {}
): Response {
	const body = {
		...options.extra,
		success: false,
		error: message,
		code
	} satisfies ApiFailure

	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store', ...options.headers }
	})
}

/**
 * A plan or billing refusal as a v1 answer, or `null` when `error` is not one.
 * Both are outcomes rather than failures, so an idempotent mutation keeps and
 * replays them; after upgrading or paying, the agent retries with a new key.
 *
 * The statuses are `billingRefusalResponse`'s: read-only billing is a payment
 * (402), not an upgrade, because the plan still includes what was refused.
 */
export function agentBillingRefusal(
	error: unknown,
	request: Request
): Response | null {
	const upgradeUrl = new URL(DASHBOARD_ROUTES.BILLING_UPGRADE, request.url).href

	if (error instanceof QuotaExceededError) {
		return agentApiError(403, 'quota_exceeded', error.message, {
			extra: {
				quota: {
					limitKey: error.limitKey,
					currentValue: error.currentValue,
					limit: error.limit,
					plan: error.plan,
					upgradeTo: error.upgradeTo
				},
				upgradeUrl
			}
		})
	}
	if (error instanceof EntitlementRequiredError) {
		return isBillingStateReadOnly(error.billingState)
			? agentApiError(402, 'payment_required', error.message, {
					extra: { upgradeUrl }
				})
			: agentApiError(403, 'insufficient_plan', error.message, {
					extra: { upgradeUrl }
				})
	}
	return null
}
