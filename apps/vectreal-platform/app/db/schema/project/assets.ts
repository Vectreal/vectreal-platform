import { sql } from 'drizzle-orm'
import {
	integer,
	index,
	json,
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { folders } from './folders'
import { users } from '../core/users'
import {
	canAccessAsset,
	canAccessFolder,
	canManageAsset,
	isUserSelf
} from '../rls'

export const assetTypeEnum = pgEnum('asset_type', [
	'texture',
	'material',
	'model',
	'environment',
	'other'
])

export const assets = pgTable(
	'assets',
	{
		id: uuid('id').primaryKey(),
		folderId: uuid('folder_id')
			.notNull()
			.references(() => folders.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		type: assetTypeEnum('type').notNull(),
		filePath: text('file_path').notNull(),
		fileSize: integer('file_size'),
		mimeType: varchar('mime_type', { length: 100 }),
		metadata: json('metadata'), // Store additional asset metadata
		ownerId: uuid('owner_id')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('assets_folder_id_idx').on(table.folderId),
		index('assets_owner_id_idx').on(table.ownerId),
		pgPolicy('assets_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: canAccessAsset(table.id)
		}),
		pgPolicy('assets_insert_project_member_self_owner', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`${canAccessFolder(table.folderId)} and ${isUserSelf(table.ownerId)}`
		}),
		pgPolicy('assets_update_project_member_owner', {
			for: 'update',
			to: authenticatedRole,
			using: canAccessAsset(table.id),
			withCheck: sql`${canManageAsset(table.id)} and ${isUserSelf(table.ownerId)}`
		}),
		pgPolicy('assets_delete_project_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageAsset(table.id)
		})
	]
).enableRLS()
