import { QuotaExceededError } from './quota-exceeded-error'

import type {
	BillingState,
	EntitlementKey,
	Plan
} from '../../../constants/plan-config'

/**
 * Thrown when an entitlement an operation needs is not granted.
 *
 * The sibling of `QuotaExceededError`, for the other half of the same question:
 * a quota says how much, an entitlement says whether at all. Both exist so an
 * operation can refuse without deciding what HTTP status that becomes, which is
 * the route's job.
 *
 * `billingState` is carried because the answer differs. An entitlement withheld
 * by the plan is a 403 and an upgrade; the same entitlement withheld because
 * billing went read-only is a 402 and a payment. `publishScene` makes exactly
 * that distinction inline, having no error type to throw.
 */
export class EntitlementRequiredError extends Error {
	readonly entitlementKey: EntitlementKey
	readonly plan: Plan
	readonly billingState: BillingState
	readonly upgradeTo: Plan | null

	constructor(params: {
		entitlementKey: EntitlementKey
		plan: Plan
		billingState: BillingState
		upgradeTo: Plan | null
		message: string
	}) {
		super(params.message)
		this.name = 'EntitlementRequiredError'
		this.entitlementKey = params.entitlementKey
		this.plan = params.plan
		this.billingState = params.billingState
		this.upgradeTo = params.upgradeTo
	}
}

/**
 * The domain errors the scene route knows how to turn into a response.
 *
 * The three upload operations each wrap their body in a catch that flattens
 * everything to `ApiResponse.serverError`. Adding a second `instanceof` to each
 * of them for every new error type is how that catch quietly starts swallowing
 * the next one, so the question is asked once, here.
 */
export function isRoutableDomainError(
	error: unknown
): error is EntitlementRequiredError | QuotaExceededError {
	return (
		error instanceof EntitlementRequiredError ||
		error instanceof QuotaExceededError
	)
}
