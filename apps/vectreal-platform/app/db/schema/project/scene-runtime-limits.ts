import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'

export const sceneRuntimeLimits = pgTable('scene_runtime_limits', {
	key: text('key').primaryKey(),
	inFlight: integer('in_flight').notNull().default(0),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
})
