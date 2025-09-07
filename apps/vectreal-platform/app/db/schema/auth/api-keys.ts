import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from '../core/users'

export const apiKeys = pgTable('api_keys', {
	id: uuid('id').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	hashedKey: text('hashed_key').notNull(),
	active: boolean('active').default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
})
