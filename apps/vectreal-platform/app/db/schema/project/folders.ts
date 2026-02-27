import {
	AnyPgColumn,
	index,
	pgPolicy,
	pgTable,
	text,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { projects } from './projects'
import { canAccessFolder, canManageFolder, canManageProject } from '../rls'

export const folders = pgTable(
	'folders',
	{
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
	},
	(table) => [
		index('folders_project_id_idx').on(table.projectId),
		index('folders_parent_folder_id_idx').on(table.parentFolderId),
		pgPolicy('folders_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: canAccessFolder(table.id)
		}),
		pgPolicy('folders_insert_project_admin', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: canManageProject(table.projectId)
		}),
		pgPolicy('folders_update_project_admin', {
			for: 'update',
			to: authenticatedRole,
			using: canManageFolder(table.id),
			withCheck: canManageFolder(table.id)
		}),
		pgPolicy('folders_delete_project_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageFolder(table.id)
		})
	]
).enableRLS()
