import { sql } from 'drizzle-orm'
import {
	index,
	pgPolicy,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar
} from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { users } from '../core/users'
import { isGroupMember, isGroupOwner, isUserSelf } from '../rls'

export const groups = pgTable(
	'groups',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: varchar('name', { length: 255 }).notNull(),
		description: text('description'),
		ownerId: uuid('owner_id')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('groups_owner_id_idx').on(table.ownerId),
		pgPolicy('groups_select_owner_or_member', {
			for: 'select',
			to: authenticatedRole,
			using: sql`${isUserSelf(table.ownerId)} or ${isGroupMember(table.id)}`
		}),
		pgPolicy('groups_insert_self_owner', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: isUserSelf(table.ownerId)
		}),
		pgPolicy('groups_update_owner', {
			for: 'update',
			to: authenticatedRole,
			using: isUserSelf(table.ownerId),
			withCheck: isUserSelf(table.ownerId)
		}),
		pgPolicy('groups_delete_owner', {
			for: 'delete',
			to: authenticatedRole,
			using: isUserSelf(table.ownerId)
		})
	]
).enableRLS()

export const groupMemberships = pgTable(
	'group_memberships',
	{
		groupId: uuid('group_id')
			.references(() => groups.id, { onDelete: 'cascade' })
			.notNull(),
		userId: uuid('user_id')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.groupId, table.userId] }),
		index('group_memberships_group_id_idx').on(table.groupId),
		index('group_memberships_user_id_idx').on(table.userId),
		pgPolicy('group_memberships_select_owner_or_member', {
			for: 'select',
			to: authenticatedRole,
			using: sql`${isGroupOwner(table.groupId)} or ${isGroupMember(table.groupId)}`
		}),
		pgPolicy('group_memberships_insert_owner_or_self_join', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`${isGroupOwner(table.groupId)} or ${table.userId} = ${authUid}`
		}),
		pgPolicy('group_memberships_update_owner', {
			for: 'update',
			to: authenticatedRole,
			using: isGroupOwner(table.groupId),
			withCheck: isGroupOwner(table.groupId)
		}),
		pgPolicy('group_memberships_delete_owner_or_self', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`${isGroupOwner(table.groupId)} or ${table.userId} = ${authUid}`
		})
	]
).enableRLS()
