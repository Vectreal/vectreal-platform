import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { users } from '../core/users'

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

export const permissions = pgTable('permissions', {
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
})
