import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

export const tags = pgTable(
	'tags',
	{
		id: uuid('id').primaryKey(),
		name: text('name').notNull().unique()
	},
	() => [
		pgPolicy('tags_select_authenticated', {
			for: 'select',
			to: authenticatedRole,
			using: sql`(select ${authUid}) is not null`
		}),
		pgPolicy('tags_insert_authenticated', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`(select ${authUid}) is not null`
		}),
		pgPolicy('tags_update_authenticated', {
			for: 'update',
			to: authenticatedRole,
			using: sql`(select ${authUid}) is not null`,
			withCheck: sql`(select ${authUid}) is not null`
		}),
		pgPolicy('tags_delete_authenticated', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`(select ${authUid}) is not null`
		})
	]
).enableRLS()
