import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		email: text('email').notNull().unique(),
		name: text('name').notNull()
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
