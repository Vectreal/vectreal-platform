import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { projects } from './projects'
import { sceneFolders } from './scene-folders'

export const sceneStatusEnum = pgEnum('scene_status', [
	'draft',
	'published',
	'archived'
])

export const scenes = pgTable('scenes', {
	id: uuid('id').primaryKey().defaultRandom(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	folderId: uuid('folder_id').references(() => sceneFolders.id),
	name: text('name').notNull(),
	description: text('description'),
	status: sceneStatusEnum('status').default('draft').notNull(),
	thumbnailUrl: text('thumbnail_url'), // Cloud storage URL for thumbnail
	thumbnailPath: text('thumbnail_path'), // Storage path for thumbnail
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
})
