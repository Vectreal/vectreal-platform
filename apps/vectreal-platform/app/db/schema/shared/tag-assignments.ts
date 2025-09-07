import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'

import { tags } from './tags'

export const tagAssignments = pgTable(
	'tag_assignments',
	{
		tagId: uuid('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' }),
		targetType: text('target_type', {
			enum: ['asset', 'scene', 'folder']
		}).notNull(),
		targetId: uuid('target_id').notNull()
	},
	(table) => ({
		pk: primaryKey({ columns: [table.tagId, table.targetType, table.targetId] })
	})
)
