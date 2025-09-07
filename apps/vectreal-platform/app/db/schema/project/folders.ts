import { AnyPgColumn, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { projects } from './projects'

export const folders = pgTable('folders', {
	id: uuid('id').primaryKey(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	parentFolderId: uuid('parent_folder_id').references(
		(): AnyPgColumn => folders.id,
		{
			onDelete: 'set null'
		}
	)
})
