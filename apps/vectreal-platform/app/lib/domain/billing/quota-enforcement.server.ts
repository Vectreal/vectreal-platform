/**
 * Refuses an operation that would take an organization past a plan limit.
 *
 * Counts real rows rather than going through `checkQuota`. That helper reads
 * `org_usage_counters`, and nothing in the app calls `incrementUsage` or
 * `decrementUsage`, so every counter sits at zero and `checkQuota` can never
 * report an exceeded limit. Four call sites routed their guard through it and
 * enforced nothing for the life of the product: a free organization could
 * create its second project by resubmitting the ordinary form.
 *
 * `getQuotaLimit` is used as-is. The limit side reads plan config and per-org
 * overrides and works; only the usage side was inert.
 *
 * `measure` is a callback so the query stays next to the rows it counts and
 * runs only when a limit actually applies. `getQuotaLimit` has already merged
 * any per-org override by the time it returns, so a `null` here means unlimited
 * rather than "look somewhere else", and no count is issued.
 */

import {
	getQuotaLimit,
	getRecommendedUpgrade
} from './entitlement-service.server'
import { QuotaExceededError } from './quota-exceeded-error'

import type { LimitKey } from '../../../constants/plan-config'

export async function assertWithinQuota(params: {
	organizationId: string
	limitKey: LimitKey
	/** Current usage, measured from rows that exist. */
	measure: () => Promise<number>
	/** What this operation would add. Defaults to one row. */
	adds?: number
	/** Built only on refusal, so it can name the limit it hit. */
	message: (context: { limit: number; current: number }) => string
}): Promise<void> {
	const { organizationId, limitKey, measure, adds = 1, message } = params

	const { limit, effectivePlan } = await getQuotaLimit(organizationId, limitKey)
	if (limit === null) {
		return
	}

	const current = await measure()
	if (current + adds <= limit) {
		return
	}

	throw new QuotaExceededError({
		limitKey,
		currentValue: current,
		limit,
		plan: effectivePlan,
		upgradeTo: getRecommendedUpgrade(effectivePlan),
		message: message({ limit, current })
	})
}
