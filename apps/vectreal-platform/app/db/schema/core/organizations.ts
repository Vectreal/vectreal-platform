import { sql } from 'drizzle-orm'
import {
	index,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { users } from './users'

export const organizations = pgTable(
	'organizations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		ownerId: uuid('owner_id').references(() => users.id, {
			onDelete: 'cascade'
		}),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		index('organizations_owner_id_idx').on(table.ownerId),
		pgPolicy('organizations_select_member', {
			for: 'select',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = ${table.id}
						and om.user_id = ${authUid}
				)
			`
		}),
		pgPolicy('organizations_insert_owner', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`${table.ownerId} = ${authUid}`
		}),
		pgPolicy('organizations_update_owner', {
			for: 'update',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = ${table.id}
						and om.user_id = ${authUid}
						and om.role = 'owner'
				)
			`,
			withCheck: sql`
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = ${table.id}
						and om.user_id = ${authUid}
						and om.role = 'owner'
				)
			`
		}),
		pgPolicy('organizations_delete_owner', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = ${table.id}
						and om.user_id = ${authUid}
						and om.role = 'owner'
				)
			`
		})
	]
).enableRLS()
