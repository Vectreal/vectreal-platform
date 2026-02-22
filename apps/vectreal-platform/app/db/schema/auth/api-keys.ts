import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from '../core/users'

export const apiKeys = pgTable('api_keys', {
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
})
