import {
	bigint,
	index,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { organizations } from '../core/organizations'

/**
 * Tracks rolling usage per organisation for quota-enforced capabilities.
 *
 * One row exists per (organization_id, counter_key, window_start) tuple.
 * The current window row is identified as the row where window_start is the
 * most recent period boundary for that counter.
 *
 * Counter keys correspond to limit keys in prd/02-limits-and-quotas.md,
 * e.g. "optimization_runs_per_month", "api_requests_per_month".
 */
export const orgUsageCounters = pgTable(
	'org_usage_counters',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		/** Canonical counter key, e.g. "optimization_runs_per_month". */
		counterKey: text('counter_key').notNull(),
		/**
		 * Accumulated value for the current window.
		 * For byte-based counters this is in bytes; for count-based counters it is
		 * an integer count.
		 */
		value: bigint('value', { mode: 'number' }).notNull().default(0),
		/** Start of the current measurement window (UTC). */
		windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
		/** End of the current measurement window (UTC). */
		windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('org_usage_counters_org_key_window_idx').on(
			table.organizationId,
			table.counterKey,
			table.windowStart
		),
		index('org_usage_counters_window_end_idx').on(table.windowEnd)
	]
)
