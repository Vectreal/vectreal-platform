import { sql } from 'drizzle-orm'
import {
	index,
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { projects } from './projects'
import { sceneFolders } from './scene-folders'
import {
	canAccessProject,
	canAccessScene,
	canManageScene,
	canAccessSceneFolder
} from '../rls'

export const sceneStatusEnum = pgEnum('scene_status', [
	'draft',
	'published',
	'archived'
])

export const scenes = pgTable(
	'scenes',
	{
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
	},
	(table) => [
		index('scenes_project_id_idx').on(table.projectId),
		index('scenes_folder_id_idx').on(table.folderId),
		pgPolicy('scenes_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: canAccessScene(table.id)
		}),
		pgPolicy('scenes_insert_project_member', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`
				${canAccessProject(table.projectId)}
				and (${table.folderId} is null or ${canAccessSceneFolder(table.folderId)})
			`
		}),
		pgPolicy('scenes_update_project_member', {
			for: 'update',
			to: authenticatedRole,
			using: canAccessScene(table.id),
			withCheck: sql`
				${canAccessScene(table.id)}
				and (${table.folderId} is null or ${canAccessSceneFolder(table.folderId)})
			`
		}),
		pgPolicy('scenes_delete_project_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageScene(table.id)
		})
	]
).enableRLS()
