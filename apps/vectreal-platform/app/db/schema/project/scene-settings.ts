import {
	boolean,
	integer,
	json,
	pgTable,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { users } from '../core/users'

import { scenes } from './scenes'

export const sceneSettings = pgTable('scene_settings', {
	id: uuid('id').primaryKey().defaultRandom(),
	sceneId: uuid('scene_id')
		.references(() => scenes.id, { onDelete: 'cascade' })
		.notNull(),
	version: integer('version').notNull().default(1),
	isLatest: boolean('is_latest').default(true).notNull(),
	// Scene configuration data from publisher store
	environment: json('environment'), // environmentAtom data
	toneMapping: json('tone_mapping'), // toneMappingAtom data
	controls: json('controls'), // controlsAtom data
	shadows: json('shadows'), // shadowsAtom data
	meta: json('meta'), // metaAtom data (scene name, thumbnail, etc.)
	createdAt: timestamp('created_at').defaultNow().notNull(),
	createdBy: uuid('created_by')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull()
})
