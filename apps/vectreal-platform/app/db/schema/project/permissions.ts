import { sql } from 'drizzle-orm'
import {
	index,
	pgEnum,
	pgPolicy,
	pgTable,
	timestamp,
	uuid,
	varchar
} from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { users } from '../core/users'
import { isGroupMember, isGroupOwner, isUserSelf } from '../rls'

export const permissionTypeEnum = pgEnum('permission_type', [
	'read',
	'write',
	'admin',
	'delete'
])

export const permissionEntityEnum = pgEnum('permission_entity', [
	'user',
	'group'
])

export const permissions = pgTable(
	'permissions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		resourceType: varchar('resource_type', { length: 50 }).notNull(), // 'scene', 'asset', 'folder'
		resourceId: uuid('resource_id').notNull(), // ID of the resource
		entityType: permissionEntityEnum('entity_type').notNull(),
		entityId: uuid('entity_id').notNull(), // user_id or group_id
		permission: permissionTypeEnum('permission').notNull(),
		grantedBy: uuid('granted_by')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		expiresAt: timestamp('expires_at')
	},
	(table) => [
		index('permissions_granted_by_idx').on(table.grantedBy),
		pgPolicy('permissions_select_recipient_or_granter', {
			for: 'select',
			to: authenticatedRole,
			using: sql`
				${isUserSelf(table.grantedBy)}
				or (${table.entityType} = 'user' and ${table.entityId} = ${authUid})
				or (${table.entityType} = 'group' and ${isGroupMember(table.entityId)})
			`
		}),
		pgPolicy('permissions_insert_self_or_group_owner', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`
				${isUserSelf(table.grantedBy)}
				and (
					(${table.entityType} = 'user' and ${table.entityId} = ${authUid})
					or (${table.entityType} = 'group' and ${isGroupOwner(table.entityId)})
				)
			`
		}),
		pgPolicy('permissions_update_granter_or_group_owner', {
			for: 'update',
			to: authenticatedRole,
			using: sql`${isUserSelf(table.grantedBy)} or (${table.entityType} = 'group' and ${isGroupOwner(table.entityId)})`,
			withCheck: sql`${isUserSelf(table.grantedBy)} or (${table.entityType} = 'group' and ${isGroupOwner(table.entityId)})`
		}),
		pgPolicy('permissions_delete_granter_or_group_owner', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`${isUserSelf(table.grantedBy)} or (${table.entityType} = 'group' and ${isGroupOwner(table.entityId)})`
		})
	]
).enableRLS()
