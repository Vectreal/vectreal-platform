import {
	integer,
	json,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar
} from 'drizzle-orm/pg-core'

import { users } from '../core/users'

import { folders } from './folders'

export const assetTypeEnum = pgEnum('asset_type', [
	'texture',
	'material',
	'model',
	'environment',
	'other'
])

export const assets = pgTable('assets', {
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
})
