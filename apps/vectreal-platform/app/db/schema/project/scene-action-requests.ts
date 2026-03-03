import {
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

export const sceneActionRequestStatusEnum = pgEnum(
	'scene_action_request_status',
	['pending', 'completed', 'failed']
)

export const sceneActionRequests = pgTable(
	'scene_action_requests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		requestKey: text('request_key').notNull().unique(),
		action: text('action').notNull(),
		requestId: text('request_id').notNull(),
		sceneId: uuid('scene_id'),
		userId: text('user_id').notNull(),
		status: sceneActionRequestStatusEnum('status').notNull().default('pending'),
		responseStatus: integer('response_status'),
		responseBody: json('response_body'),
		errorMessage: text('error_message'),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('scene_action_requests_status_idx').on(table.status),
		index('scene_action_requests_scene_id_idx').on(table.sceneId),
		index('scene_action_requests_expires_at_idx').on(table.expiresAt)
	]
)
