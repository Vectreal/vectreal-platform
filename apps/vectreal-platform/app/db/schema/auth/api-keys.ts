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

import { users } from '../core/users'
import { isUserSelf } from '../rls'

export const apiKeys = pgTable(
	'api_keys',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		hashedKey: text('hashed_key').notNull(),
		active: boolean('active').default(true),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('api_keys_user_id_idx').on(table.userId),
		pgPolicy('api_keys_select_self', {
			for: 'select',
			to: authenticatedRole,
			using: isUserSelf(table.userId)
		}),
		pgPolicy('api_keys_insert_self', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: isUserSelf(table.userId)
		}),
		pgPolicy('api_keys_update_self', {
			for: 'update',
			to: authenticatedRole,
			using: isUserSelf(table.userId),
			withCheck: isUserSelf(table.userId)
		}),
		pgPolicy('api_keys_delete_self', {
			for: 'delete',
			to: authenticatedRole,
			using: isUserSelf(table.userId)
		})
	]
).enableRLS()
