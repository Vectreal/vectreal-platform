import { ApiResponse } from '@shared/utils'

import { EntitlementRequiredError } from './entitlement-required-error'
import { QuotaExceededError } from './quota-exceeded-error'
import { isBillingStateReadOnly } from '../../../constants/plan-config'

/**
 * A quota refusal with the fields the upgrade prompt reads. Four routes built
 * this response field by field before it had an owner.
 */
export function quotaExceededResponse(error: QuotaExceededError): Response {
	return ApiResponse.quotaExceeded(error.message, {
		limitKey: error.limitKey,
		currentValue: error.currentValue,
		limit: error.limit,
		plan: error.plan,
		upgradeTo: error.upgradeTo
	})
}

/**
 * The response for a billing refusal, or `null` when `error` is not one.
 *
 * Read-only billing is a payment, not an upgrade: the plan still grants the
 * entitlement and the account has simply stopped paying for it. Sending 403
 * there tells the owner to buy something they already own, so it is 402.
 */
export function billingRefusalResponse(error: unknown): Response | null {
	if (error instanceof EntitlementRequiredError) {
		return isBillingStateReadOnly(error.billingState)
			? ApiResponse.paymentRequired(error.message)
			: ApiResponse.forbidden(error.message)
	}
	if (error instanceof QuotaExceededError) {
		return quotaExceededResponse(error)
	}
	return null
}
