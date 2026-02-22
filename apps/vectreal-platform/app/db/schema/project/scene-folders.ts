import {
	AnyPgColumn,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { projects } from './projects'
import { users } from '../core/users'


export const sceneFolders = pgTable('scene_folders', {
	id: uuid('id').primaryKey().defaultRandom(),
	projectId: uuid('project_id')
		.notNull()
		.references((): typeof projects.id => projects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	ownerId: uuid('owner_id')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	parentFolderId: uuid('parent_folder_id').references(
		(): AnyPgColumn => sceneFolders.id,
		{
			onDelete: 'set null'
		}
	),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
})
