/**
 * Usage accounting primitives.
 *
 * Provides atomic increment/decrement operations for per-organisation usage
 * counters and integrates with the quota-limit checks defined in
 * prd/02-limits-and-quotas.md.
 *
 * Design notes:
 *   - All mutations use database-level atomic updates to prevent double-
 *     counting under concurrent request load.
 *   - Counter windows are key-aware:
 *       - Monthly counters use calendar-month windows in UTC.
 *       - Per-minute counters use UTC minute windows.
 *       - Cumulative counters use a non-expiring window.
 *   - Soft-limit warnings fire at 80 % of the hard limit.
 *   - When a quota is `null` (unlimited) the action is always allowed.
 */

import { and, eq, lt, sql } from 'drizzle-orm'

import { getQuotaLimit } from './entitlement-service.server'
import { toSafeNumberFromBigInt } from './number-utils.server'
import { type LimitKey } from '../../../constants/plan-config'
import { getDbClient } from '../../../db/client'
import { orgUsageCounters } from '../../../db/schema/billing/usage-counters'

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

/** Soft-limit warning threshold (80 % of the hard limit). */
const SOFT_LIMIT_THRESHOLD = 0.8

const NON_EXPIRING_WINDOW_START = new Date('1970-01-01T00:00:00.000Z')
const NON_EXPIRING_WINDOW_END = new Date('9999-12-31T23:59:59.999Z')

const MONTHLY_COUNTER_KEYS: ReadonlySet<LimitKey> = new Set([
	'optimization_runs_per_month',
	'api_requests_per_month',
	'embed_bandwidth_gb_per_month',
	'preview_loads_per_month'
])

const MINUTE_COUNTER_KEYS: ReadonlySet<LimitKey> = new Set([
	'api_requests_per_minute'
])

/**
 * Returns the UTC start and end of the current calendar month window.
 */
export function currentMonthWindow(now: Date = new Date()): {
	windowStart: Date
	windowEnd: Date
} {
	const windowStart = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
	)
	const windowEnd = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
	)
	return { windowStart, windowEnd }
}

export function currentMinuteWindow(now: Date = new Date()): {
	windowStart: Date
	windowEnd: Date
} {
	const windowStart = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			now.getUTCHours(),
			now.getUTCMinutes(),
			0,
			0
		)
	)
	const windowEnd = new Date(windowStart.getTime() + 60 * 1000)
	return { windowStart, windowEnd }
}

function getCounterWindow(
	counterKey: LimitKey,
	now: Date = new Date()
): { windowStart: Date; windowEnd: Date } {
	if (MONTHLY_COUNTER_KEYS.has(counterKey)) {
		return currentMonthWindow(now)
	}

	if (MINUTE_COUNTER_KEYS.has(counterKey)) {
		return currentMinuteWindow(now)
	}

	return {
		windowStart: NON_EXPIRING_WINDOW_START,
		windowEnd: NON_EXPIRING_WINDOW_END
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UsageCheckOutcome =
	| 'allowed'
	| 'soft_limit_warning'
	| 'hard_limit_exceeded'
	| 'unlimited'

export interface UsageCheckResult {
	outcome: UsageCheckOutcome
	currentValue: number
	/** Resolved hard limit (null = unlimited). */
	limit: number | null
	/** How much of the quota has been consumed (0–1, or null if unlimited). */
	usageFraction: number | null
}

// ---------------------------------------------------------------------------
// Core primitives
// ---------------------------------------------------------------------------

/**
 * Returns (or initialises) the usage counter row for the current window.
 */
async function getOrCreateCounter(
	organizationId: string,
	counterKey: LimitKey,
	windowStart: Date,
	windowEnd: Date
): Promise<{ id: string; value: number }> {
	const db = getDbClient()

	// Upsert the counter row for the current window
	const [row] = await db
		.insert(orgUsageCounters)
		.values({
			organizationId,
			counterKey,
			value: BigInt(0),
			windowStart,
			windowEnd
		})
		.onConflictDoNothing({
			target: [
				orgUsageCounters.organizationId,
				orgUsageCounters.counterKey,
				orgUsageCounters.windowStart
			]
		})
		.returning({ id: orgUsageCounters.id, value: orgUsageCounters.value })

	if (row) {
		return {
			id: row.id,
			value: toSafeNumberFromBigInt(row.value, 'counterValue')
		}
	}

	// Row already exists — fetch it
	const [existing] = await db
		.select({ id: orgUsageCounters.id, value: orgUsageCounters.value })
		.from(orgUsageCounters)
		.where(
			and(
				eq(orgUsageCounters.organizationId, organizationId),
				eq(orgUsageCounters.counterKey, counterKey),
				eq(orgUsageCounters.windowStart, windowStart)
			)
		)
		.limit(1)

	if (!existing) {
		throw new Error(
			`Failed to get or create usage counter for org=${organizationId} key=${counterKey}`
		)
	}
	return {
		id: existing.id,
		value: toSafeNumberFromBigInt(existing.value, 'counterValue')
	}
}

function ensurePositiveInteger(value: number, fieldName: string): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${fieldName} must be a positive integer`)
	}
}

/**
 * Atomically increments a usage counter by `delta` and returns the new value.
 * `delta` must be a positive integer.
 * @throws {Error} When `delta` is not a positive integer.
 */
export async function incrementUsage(
	organizationId: string,
	counterKey: LimitKey,
	delta: number = 1
): Promise<number> {
	ensurePositiveInteger(delta, 'delta')
	const deltaBigInt = BigInt(delta)
	const { windowStart, windowEnd } = getCounterWindow(counterKey)

	const db = getDbClient()

	// Ensure the row exists before updating
	await getOrCreateCounter(organizationId, counterKey, windowStart, windowEnd)

	const [updated] = await db
		.update(orgUsageCounters)
		.set({
			value: sql`${orgUsageCounters.value} + ${deltaBigInt}`,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(orgUsageCounters.organizationId, organizationId),
				eq(orgUsageCounters.counterKey, counterKey),
				eq(orgUsageCounters.windowStart, windowStart)
			)
		)
		.returning({ value: orgUsageCounters.value })

	if (!updated) {
		throw new Error(
			`Failed to increment usage counter for org=${organizationId} key=${counterKey}`
		)
	}
	return toSafeNumberFromBigInt(updated.value, 'counterValue')
}

/**
 * Atomically decrements a usage counter by `delta` (floors at 0).
 * `delta` must be a positive integer.
 * @throws {Error} When `delta` is not a positive integer.
 */
export async function decrementUsage(
	organizationId: string,
	counterKey: LimitKey,
	delta: number = 1
): Promise<number> {
	ensurePositiveInteger(delta, 'delta')
	const deltaBigInt = BigInt(delta)

	const db = getDbClient()
	const { windowStart, windowEnd } = getCounterWindow(counterKey)

	await getOrCreateCounter(organizationId, counterKey, windowStart, windowEnd)

	const [updated] = await db
		.update(orgUsageCounters)
		.set({
			value: sql`greatest(${orgUsageCounters.value} - ${deltaBigInt}, 0)`,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(orgUsageCounters.organizationId, organizationId),
				eq(orgUsageCounters.counterKey, counterKey),
				eq(orgUsageCounters.windowStart, windowStart)
			)
		)
		.returning({ value: orgUsageCounters.value })

	if (!updated) {
		throw new Error(
			`Failed to decrement usage counter for org=${organizationId} key=${counterKey}`
		)
	}
	return toSafeNumberFromBigInt(updated.value, 'counterValue')
}

/**
 * Reads the current usage value without modifying it.
 */
export async function getCurrentUsage(
	organizationId: string,
	counterKey: LimitKey
): Promise<number> {
	const { windowStart, windowEnd } = getCounterWindow(counterKey)
	const counter = await getOrCreateCounter(
		organizationId,
		counterKey,
		windowStart,
		windowEnd
	)
	return counter.value
}

// ---------------------------------------------------------------------------
// Quota check
// ---------------------------------------------------------------------------

/**
 * Checks whether a proposed increment would exceed the quota limit.
 *
 * This performs a non-mutating check — callers are responsible for calling
 * `incrementUsage` if they wish to consume the quota.
 *
 * Returns:
 *   - `unlimited`           — quota is null (enterprise)
 *   - `allowed`             — usage + delta < hard limit and below soft threshold
 *   - `soft_limit_warning`  — usage + delta >= 80 % of hard limit but <= hard limit
 *   - `hard_limit_exceeded` — usage + delta > hard limit
 */
export async function checkQuota(
	organizationId: string,
	counterKey: LimitKey,
	delta: number = 1
): Promise<UsageCheckResult> {
	ensurePositiveInteger(delta, 'delta')

	const [{ limit }, currentValue] = await Promise.all([
		getQuotaLimit(organizationId, counterKey),
		getCurrentUsage(organizationId, counterKey)
	])

	if (limit === null) {
		return {
			outcome: 'unlimited',
			currentValue,
			limit: null,
			usageFraction: null
		}
	}

	const projected = currentValue + delta
	const usageFraction = projected / limit

	if (projected > limit) {
		return {
			outcome: 'hard_limit_exceeded',
			currentValue,
			limit,
			usageFraction
		}
	}

	if (usageFraction >= SOFT_LIMIT_THRESHOLD) {
		return { outcome: 'soft_limit_warning', currentValue, limit, usageFraction }
	}

	return { outcome: 'allowed', currentValue, limit, usageFraction }
}

// ---------------------------------------------------------------------------
// Reconciliation helper
// ---------------------------------------------------------------------------

/**
 * Resets a specific counter to a given absolute value for the current window.
 * Intended for use in reconciliation / correction runbooks.
 * @throws {Error} When `correctedValue` is negative or non-integer.
 */
export async function reconcileUsageCounter(
	organizationId: string,
	counterKey: LimitKey,
	correctedValue: number
): Promise<void> {
	if (!Number.isInteger(correctedValue) || correctedValue < 0) {
		throw new Error('correctedValue must be a non-negative integer')
	}

	const db = getDbClient()
	const { windowStart, windowEnd } = getCounterWindow(counterKey)

	await getOrCreateCounter(organizationId, counterKey, windowStart, windowEnd)

	await db
		.update(orgUsageCounters)
		.set({ value: BigInt(correctedValue), updatedAt: new Date() })
		.where(
			and(
				eq(orgUsageCounters.organizationId, organizationId),
				eq(orgUsageCounters.counterKey, counterKey),
				eq(orgUsageCounters.windowStart, windowStart)
			)
		)
}

/**
 * Cleans up expired usage-counter windows older than the current window.
 * Run periodically (e.g., a cron job) to keep the table small.
 */
export async function pruneExpiredUsageWindows(): Promise<number> {
	const db = getDbClient()
	const { windowStart } = currentMonthWindow()

	const deleted = await db
		.delete(orgUsageCounters)
		.where(
			// Delete rows whose window ended before the current window started
			lt(orgUsageCounters.windowEnd, windowStart)
		)
		.returning({ id: orgUsageCounters.id })

	return deleted.length
}
