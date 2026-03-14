import type { Plan } from '../../../constants/plan-config'

/**
 * Thrown when an organisation has consumed its hard quota for a given limit key.
 * Callers (typically route action handlers) should catch this and return an
 * appropriate 402 / 403 HTTP response with machine-readable quota details.
 */
export class QuotaExceededError extends Error {
	readonly limitKey: string
	readonly currentValue: number
	readonly limit: number | null
	readonly plan: Plan
	readonly upgradeTo: Plan | null

	constructor(params: {
		limitKey: string
		currentValue: number
		limit: number | null
		plan: Plan
		upgradeTo: Plan | null
		message?: string
	}) {
		super(
			params.message ??
				`Quota exceeded for limit key: ${params.limitKey}. Current: ${params.currentValue}, Limit: ${params.limit}.`
		)
		this.name = 'QuotaExceededError'
		this.limitKey = params.limitKey
		this.currentValue = params.currentValue
		this.limit = params.limit
		this.plan = params.plan
		this.upgradeTo = params.upgradeTo
	}
}
