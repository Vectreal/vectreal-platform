import { createBillingLimitErrorFromResponse } from '../../../../lib/domain/billing/client/billing-limit-error'

export type OptimizationRunIntent = 'check' | 'consume'

export type OptimizationQuotaResult = {
	outcome?: string
	currentValue?: number
	limit?: null | number
	remaining?: null | number
	isGuest?: boolean
	windowExpiresAt?: number
}

export type GuestQuotaState = {
	currentValue: number
	limit: number
	remaining: number
}

export const DEFAULT_GUEST_QUOTA_LIMIT = 5

export function toGuestQuotaState(
	result: OptimizationQuotaResult
): GuestQuotaState {
	const limit =
		typeof result.limit === 'number' ? result.limit : DEFAULT_GUEST_QUOTA_LIMIT
	const currentValue =
		typeof result.currentValue === 'number' ? result.currentValue : 0
	const remaining =
		typeof result.remaining === 'number'
			? result.remaining
			: Math.max(0, limit - currentValue)

	return { currentValue, limit, remaining }
}

/** Race a promise against a timeout. Rejects with a descriptive error on timeout. */
export function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	label: string
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`${label} timed out after ${ms}ms`)),
			ms
		)
		promise.then(
			(val) => {
				clearTimeout(timer)
				resolve(val)
			},
			(err) => {
				clearTimeout(timer)
				reject(err)
			}
		)
	})
}

export const QUOTA_CHECK_TIMEOUT_MS = 10_000

type QuotaResponsePayload = {
	error?: string
	success?: boolean
	quota?: unknown
	data?: {
		outcome?: string
		currentValue?: number
		limit?: null | number
		remaining?: null | number
		isGuest?: boolean
		windowExpiresAt?: number
	}
} | null

export async function requestOptimizationRunQuota(
	intent: OptimizationRunIntent
): Promise<OptimizationQuotaResult> {
	const fallbackMessage =
		intent === 'check'
			? 'Unable to validate optimization quota before starting.'
			: 'Unable to record optimization run usage.'

	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), QUOTA_CHECK_TIMEOUT_MS)

	let response: Response
	try {
		response = await fetch('/api/billing/optimization-runs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ intent }),
			signal: controller.signal
		})
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(
				`Quota request timed out after ${QUOTA_CHECK_TIMEOUT_MS}ms.`
			)
		}
		throw new Error(
			error instanceof Error && error.message
				? `${fallbackMessage} ${error.message}`
				: fallbackMessage
		)
	} finally {
		clearTimeout(timeoutId)
	}

	let payload: QuotaResponsePayload = null
	try {
		payload = (await response.json()) as QuotaResponsePayload
	} catch {
		payload = null
	}

	if (!response.ok || payload?.success === false) {
		const billingLimitError = createBillingLimitErrorFromResponse(
			response.status,
			payload,
			fallbackMessage
		)
		if (billingLimitError) throw billingLimitError
		throw new Error(payload?.error || fallbackMessage)
	}

	return {
		outcome: payload?.data?.outcome,
		currentValue: payload?.data?.currentValue,
		limit: payload?.data?.limit,
		remaining: payload?.data?.remaining,
		isGuest: payload?.data?.isGuest,
		windowExpiresAt: payload?.data?.windowExpiresAt
	}
}
