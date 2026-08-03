import { sql } from 'drizzle-orm'
import {
	AnyPgColumn,
	check,
	index,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { projects } from './projects'
import { users } from '../core/users'
import {
	canAccessProject,
	canAccessSceneFolder,
	canManageSceneFolder,
	isUserSelf
} from '../rls'

export const sceneFolders = pgTable(
	'scene_folders',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references((): typeof projects.id => projects.id, {
				onDelete: 'cascade'
			}),
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
	},
	(table) => [
		index('scene_folders_project_id_idx').on(table.projectId),
		index('scene_folders_owner_id_idx').on(table.ownerId),
		index('scene_folders_parent_folder_id_idx').on(table.parentFolderId),
		/*
		  A folder cannot be its own parent.

		  This is the only part of the cycle guard a constraint can express.
		  Catching a longer cycle (A -> B -> A) needs a recursive lookup, which
		  means a trigger, which cannot be generated from this schema - so
		  multi-hop cycles stay the application's job, in `validateFolderMove`.
		  That is the only code that writes `parent_folder_id` after creation.

		  A cycle here is not a cosmetic problem: `getSceneFolderAncestry` throws
		  when it walks one, which takes the whole folder tree down.
		*/
		check(
			'scene_folders_parent_not_self',
			sql`${table.parentFolderId} is null or ${table.parentFolderId} <> ${table.id}`
		),
		pgPolicy('scene_folders_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: canAccessSceneFolder(table.id)
		}),
		pgPolicy('scene_folders_insert_project_member_self_owner', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`${canAccessProject(table.projectId)} and ${isUserSelf(table.ownerId)}`
		}),
		pgPolicy('scene_folders_update_owner_or_admin', {
			for: 'update',
			to: authenticatedRole,
			using: sql`${canManageSceneFolder(table.id)} or ${isUserSelf(table.ownerId)}`,
			withCheck: sql`${canManageSceneFolder(table.id)} or ${isUserSelf(table.ownerId)}`
		}),
		pgPolicy('scene_folders_delete_owner_or_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`${canManageSceneFolder(table.id)} or ${isUserSelf(table.ownerId)}`
		})
	]
).enableRLS()
