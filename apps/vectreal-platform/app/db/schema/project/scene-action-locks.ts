import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const sceneActionLocks = pgTable(
	'scene_action_locks',
	{
		sceneId: uuid('scene_id').primaryKey(),
		holderKey: text('holder_key').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [index('scene_action_locks_expires_at_idx').on(table.expiresAt)]
).enableRLS()
