import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		email: text('email').notNull().unique(),
		name: text('name').notNull(),
		/** Onboarding: profession/role the user identifies with */
		role: text('role'),
		/** Onboarding: intended use case for the platform */
		useCase: text('use_case'),
		/** Onboarding: optional company or team name */
		companyName: text('company_name'),
		/** Onboarding: how the user heard about Vectreal */
		referralSource: text('referral_source'),
		/** Timestamp of ToS + Privacy Policy acceptance, written at account creation */
		tosAcceptedAt: timestamp('tos_accepted_at', { withTimezone: true })
	},
	(table) => [
		pgPolicy('users_select_self', {
			for: 'select',
			to: authenticatedRole,
			using: sql`${table.id} = ${authUid}`
		}),
		pgPolicy('users_insert_self', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`${table.id} = ${authUid}`
		}),
		pgPolicy('users_update_self', {
			for: 'update',
			to: authenticatedRole,
			using: sql`${table.id} = ${authUid}`,
			withCheck: sql`${table.id} = ${authUid}`
		})
	]
).enableRLS()
