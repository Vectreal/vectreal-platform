import { sql } from 'drizzle-orm'
import {
	boolean,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { users } from '../core/users'

/**
 * Consent records — kept in sync with prd/05-consent-categories.md
 *
 * Stores one row per consent interaction. For authenticated users the row is
 * tied to `user_id`; for anonymous visitors `anonymous_id` is used instead.
 * When an authenticated user previously acted anonymously, their anonymous
 * record is superseded on first authenticated upsert.
 *
 * The `version` field tracks the semver of the consent policy at the time of
 * recording, enabling future re-consent when policy changes materially.
 */
export const consentRecords = pgTable(
	'consent_records',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** FK to users table — null for anonymous visitors. */
		userId: uuid('user_id')
			.unique()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** Populated when user_id is null (anonymous visitor). */
		anonymousId: text('anonymous_id').unique(),
		/** Semver of the consent policy accepted (e.g. "1.0.0"). */
		version: text('version').notNull().default('1.0.0'),
		/** always true — stored for auditability */
		necessary: boolean('necessary').notNull().default(true),
		/** Functional / preference cookies */
		functional: boolean('functional').notNull().default(false),
		/** Analytics & performance tracking (PostHog) */
		analytics: boolean('analytics').notNull().default(false),
		/** Marketing & personalisation */
		marketing: boolean('marketing').notNull().default(false),
		/** ISO country code inferred from IP on first visit */
		ipCountry: text('ip_country'),
		userAgent: text('user_agent'),
		recordedAt: timestamp('recorded_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		pgPolicy('consent_records_select_self', {
			for: 'select',
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`
		}),
		pgPolicy('consent_records_insert_self', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`
		}),
		pgPolicy('consent_records_update_self', {
			for: 'update',
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
			withCheck: sql`${table.userId} = ${authUid}`
		})
	]
).enableRLS()
