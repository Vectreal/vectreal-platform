import { sql } from 'drizzle-orm'
import {
	index,
	pgEnum,
	pgPolicy,
	pgTable,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { organizations } from './organizations'
import { users } from './users'

export const membershipRoleEnum = pgEnum('membership_role', [
	'owner',
	'admin',
	'member'
])

export const organizationMemberships = pgTable(
	'organization_memberships',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		role: membershipRoleEnum('role').notNull().default('member'),
		joinedAt: timestamp('joined_at').notNull().defaultNow(),
		invitedAt: timestamp('invited_at'),
		invitedBy: uuid('invited_by').references(() => users.id)
	},
	(table) => [
		index('organization_memberships_user_id_idx').on(table.userId),
		index('organization_memberships_organization_id_idx').on(
			table.organizationId
		),
		index('organization_memberships_invited_by_idx').on(table.invitedBy),
		pgPolicy('org_memberships_select_org_member', {
			for: 'select',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = ${table.organizationId}
						and om.user_id = ${authUid}
				)
			`
		}),
		pgPolicy('org_memberships_insert_org_admin', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = ${table.organizationId}
						and om.user_id = ${authUid}
						and om.role in ('owner', 'admin')
				)
			`
		}),
		pgPolicy('org_memberships_update_org_admin', {
			for: 'update',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = ${table.organizationId}
						and om.user_id = ${authUid}
						and om.role in ('owner', 'admin')
				)
			`,
			withCheck: sql`
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = ${table.organizationId}
						and om.user_id = ${authUid}
						and om.role in ('owner', 'admin')
				)
			`
		}),
		pgPolicy('org_memberships_delete_org_admin_or_self', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`
				(
					exists (
						select 1
						from organization_memberships om
						where om.organization_id = ${table.organizationId}
							and om.user_id = ${authUid}
							and om.role in ('owner', 'admin')
					)
					or ${table.userId} = ${authUid}
				)
			`
		})
	]
).enableRLS()
