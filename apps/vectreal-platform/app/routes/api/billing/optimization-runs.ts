import { ApiResponse } from '@shared/utils'

import {
	getOrgSubscription,
	getRecommendedUpgrade
} from '../../../lib/domain/billing/entitlement-service.server'
import {
	checkQuota,
	incrementUsage
} from '../../../lib/domain/billing/usage-service.server'
import { initializeUserDefaults } from '../../../lib/domain/user/user-repository.server'
import { getAuthUser } from '../../../lib/http/auth.server'
import { ensureSameOriginMutation } from '../../../lib/http/csrf.server'
import { ensurePost } from '../../../lib/http/requests.server'
import {
	commitGuestOptimizeQuotaSession,
	consumeGuestOptimizeQuota,
	getGuestOptimizeQuotaSession,
	readGuestOptimizeQuotaSnapshot
} from '../../../lib/sessions/guest-optimize-quota-session.server'

type OptimizationRunRequest = {
	intent?: 'check' | 'consume'
}

function isValidIntent(value: unknown): value is 'check' | 'consume' {
	return value === 'check' || value === 'consume'
}

function getRemaining(
	limit: null | number,
	currentValue: number
): null | number {
	if (typeof limit !== 'number') {
		return null
	}

	return Math.max(0, limit - currentValue)
}

export async function action({ request }: { request: Request }) {
	const methodCheck = ensurePost(request)
	if (methodCheck) {
		return methodCheck
	}

	const csrfCheck = ensureSameOriginMutation(request)
	if (csrfCheck) {
		return csrfCheck
	}

	let payload: OptimizationRunRequest = {}
	try {
		payload = (await request.json()) as OptimizationRunRequest
	} catch {
		return ApiResponse.badRequest('Invalid optimization run payload')
	}

	const intent = payload.intent
	if (!isValidIntent(intent)) {
		return ApiResponse.badRequest('Invalid optimization run intent')
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		const guestSession = await getGuestOptimizeQuotaSession(request)
		if (intent === 'check') {
			const guestQuota = readGuestOptimizeQuotaSnapshot(guestSession)
			return ApiResponse.success({
				intent,
				currentValue: guestQuota.currentValue,
				limit: guestQuota.limit,
				remaining: guestQuota.remaining,
				windowExpiresAt: guestQuota.windowExpiresAt,
				outcome: guestQuota.outcome,
				consumed: false,
				isGuest: true
			})
		}

		const consumeResult = consumeGuestOptimizeQuota(guestSession)
		if (!consumeResult.consumed) {
			return ApiResponse.quotaExceeded(
				'You have reached the free guest optimization limit for today. Sign in to continue with plan-based quotas.',
				{
					limitKey: 'optimization_runs_per_month',
					currentValue: consumeResult.snapshot.currentValue,
					limit: consumeResult.snapshot.limit,
					plan: 'free',
					upgradeTo: 'pro'
				}
			)
		}

		const cookieHeader = await commitGuestOptimizeQuotaSession(guestSession)
		return ApiResponse.success(
			{
				intent,
				currentValue: consumeResult.snapshot.currentValue,
				limit: consumeResult.snapshot.limit,
				remaining: consumeResult.snapshot.remaining,
				windowExpiresAt: consumeResult.snapshot.windowExpiresAt,
				outcome: consumeResult.snapshot.outcome,
				consumed: true,
				isGuest: true
			},
			200,
			{ headers: { 'Set-Cookie': cookieHeader } }
		)
	}

	let organizationId: string
	try {
		const userDefaults = await initializeUserDefaults(authResult.user)
		organizationId = userDefaults.organization.id
	} catch {
		return ApiResponse.serverError('Failed to resolve organization')
	}

	const quotaCheck = await checkQuota(
		organizationId,
		'optimization_runs_per_month'
	)
	if (quotaCheck.outcome === 'hard_limit_exceeded') {
		const { plan } = await getOrgSubscription(organizationId)
		const upgradeTo = getRecommendedUpgrade(plan)
		return ApiResponse.quotaExceeded(
			'Monthly optimization limit reached. Upgrade your plan to continue optimizing.',
			{
				limitKey: 'optimization_runs_per_month',
				currentValue: quotaCheck.currentValue,
				limit: quotaCheck.limit,
				plan,
				upgradeTo
			}
		)
	}

	if (intent === 'consume') {
		await incrementUsage(organizationId, 'optimization_runs_per_month')
	}

	return ApiResponse.success({
		intent,
		currentValue: quotaCheck.currentValue,
		limit: quotaCheck.limit,
		remaining: getRemaining(quotaCheck.limit, quotaCheck.currentValue),
		outcome: quotaCheck.outcome,
		consumed: intent === 'consume',
		isGuest: false
	})
}
