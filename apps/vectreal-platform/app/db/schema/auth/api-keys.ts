import {
	pgPolicy,
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { organizations } from '../core/organizations'
import { users } from '../core/users'
import { canManageOrgApiKeys } from '../rls'

export const apiKeys = pgTable(
	'api_keys',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		hashedKey: text('hashed_key').notNull(),
		keyPreview: text('key_preview').notNull(),
		active: boolean('active').default(true),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('api_keys_organization_id_idx').on(table.organizationId),
		index('api_keys_user_id_idx').on(table.userId),
		pgPolicy('api_keys_select_org_admin', {
			for: 'select',
			to: authenticatedRole,
			using: canManageOrgApiKeys(table.organizationId)
		}),
		pgPolicy('api_keys_insert_org_admin', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: canManageOrgApiKeys(table.organizationId)
		}),
		pgPolicy('api_keys_update_org_admin', {
			for: 'update',
			to: authenticatedRole,
			using: canManageOrgApiKeys(table.organizationId),
			withCheck: canManageOrgApiKeys(table.organizationId)
		}),
		pgPolicy('api_keys_delete_org_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageOrgApiKeys(table.organizationId)
		})
	]
).enableRLS()
