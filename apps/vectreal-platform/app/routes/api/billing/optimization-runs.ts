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
import { ensurePost } from '../../../lib/http/requests.server'

type OptimizationRunRequest = {
	intent?: 'check' | 'consume'
}

function isValidIntent(value: unknown): value is 'check' | 'consume' {
	return value === 'check' || value === 'consume'
}

export async function action({ request }: { request: Request }) {
	const methodCheck = ensurePost(request)
	if (methodCheck) {
		return methodCheck
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	let organizationId: string
	try {
		const userDefaults = await initializeUserDefaults(authResult.user)
		organizationId = userDefaults.organization.id
	} catch {
		return ApiResponse.serverError('Failed to resolve organization')
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
		outcome: quotaCheck.outcome,
		consumed: intent === 'consume'
	})
}
