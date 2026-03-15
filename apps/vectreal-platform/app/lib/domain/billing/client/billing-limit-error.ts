import { type Plan } from '../../../../constants/plan-config'

export interface BillingQuotaPayload {
	limitKey?: string
	currentValue?: number
	limit?: null | number
	plan?: string
	upgradeTo?: null | string
}

export type BillingLimitReason = 'quota_exceeded' | 'plan_inactive'

export class BillingLimitError extends Error {
	readonly reason: BillingLimitReason
	readonly status: number
	readonly quota: BillingQuotaPayload | null

	constructor(params: {
		reason: BillingLimitReason
		message: string
		status: number
		quota?: BillingQuotaPayload | null
	}) {
		super(params.message)
		this.name = 'BillingLimitError'
		this.reason = params.reason
		this.status = params.status
		this.quota = params.quota ?? null
	}
}

export function isBillingLimitError(
	error: unknown
): error is BillingLimitError {
	return error instanceof BillingLimitError
}

function parseQuotaPayload(payload: unknown): BillingQuotaPayload | null {
	if (!payload || typeof payload !== 'object' || !('quota' in payload)) {
		return null
	}

	const quota = (payload as { quota?: unknown }).quota
	if (!quota || typeof quota !== 'object') {
		return null
	}

	const typed = quota as Record<string, unknown>
	return {
		limitKey: typeof typed.limitKey === 'string' ? typed.limitKey : undefined,
		currentValue:
			typeof typed.currentValue === 'number' ? typed.currentValue : undefined,
		limit:
			typed.limit === null || typeof typed.limit === 'number'
				? (typed.limit as null | number)
				: undefined,
		plan: typeof typed.plan === 'string' ? typed.plan : undefined,
		upgradeTo:
			typed.upgradeTo === null || typeof typed.upgradeTo === 'string'
				? (typed.upgradeTo as null | string)
				: undefined
	}
}

export function createBillingLimitErrorFromResponse(
	status: number,
	payload: unknown,
	fallbackMessage: string
): BillingLimitError | null {
	if (status !== 402 && status !== 403) {
		return null
	}

	const message =
		typeof payload === 'object' &&
		payload !== null &&
		'error' in payload &&
		typeof (payload as { error?: unknown }).error === 'string'
			? (payload as { error: string }).error
			: fallbackMessage

	return new BillingLimitError({
		reason: status === 402 ? 'plan_inactive' : 'quota_exceeded',
		message,
		status,
		quota: parseQuotaPayload(payload)
	})
}

function asPlan(value: string | null | undefined): Plan | null {
	if (
		value === 'free' ||
		value === 'pro' ||
		value === 'business' ||
		value === 'enterprise'
	) {
		return value
	}

	return null
}

export function toUpgradeModalPayload(error: BillingLimitError): {
	reason: 'feature_not_available' | 'plan_inactive' | 'quota_exceeded'
	message: string
	limitKey?: string
	currentValue?: number
	limit?: null | number
	plan?: Plan
	upgradeTo?: null | Plan
} {
	const plan = asPlan(error.quota?.plan)
	const upgradeTo = asPlan(error.quota?.upgradeTo)

	return {
		reason: error.reason,
		message: error.message,
		limitKey: error.quota?.limitKey,
		currentValue: error.quota?.currentValue,
		limit: error.quota?.limit,
		plan: plan ?? undefined,
		upgradeTo
	}
}
