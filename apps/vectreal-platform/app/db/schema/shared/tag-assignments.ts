import { sql } from 'drizzle-orm'
import {
	index,
	pgPolicy,
	pgTable,
	primaryKey,
	text,
	uuid
} from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { tags } from './tags'
import { canAccessAsset, canAccessFolder, canAccessScene } from '../rls'

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
	(table) => [
		primaryKey({ columns: [table.tagId, table.targetType, table.targetId] }),
		index('tag_assignments_tag_id_idx').on(table.tagId),
		pgPolicy('tag_assignments_select_target_member', {
			for: 'select',
			to: authenticatedRole,
			using: sql`
				(${table.targetType} = 'asset' and ${canAccessAsset(table.targetId)})
				or (${table.targetType} = 'scene' and ${canAccessScene(table.targetId)})
				or (${table.targetType} = 'folder' and ${canAccessFolder(table.targetId)})
			`
		}),
		pgPolicy('tag_assignments_insert_target_member', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`
				(select ${authUid}) is not null
				and (
					(${table.targetType} = 'asset' and ${canAccessAsset(table.targetId)})
					or (${table.targetType} = 'scene' and ${canAccessScene(table.targetId)})
					or (${table.targetType} = 'folder' and ${canAccessFolder(table.targetId)})
				)
			`
		}),
		pgPolicy('tag_assignments_delete_target_member', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`
				(${table.targetType} = 'asset' and ${canAccessAsset(table.targetId)})
				or (${table.targetType} = 'scene' and ${canAccessScene(table.targetId)})
				or (${table.targetType} = 'folder' and ${canAccessFolder(table.targetId)})
			`
		})
	]
).enableRLS()
