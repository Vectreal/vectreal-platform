import {
	ControlsProps,
	EnvironmentProps,
	SceneMeta,
	ShadowsProps
} from '@vctrl/core'
import { json, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

import { scenes } from './scenes'
import { users } from '../core/users'


export const sceneSettings = pgTable('scene_settings', {
	id: uuid('id').primaryKey().defaultRandom(),
	sceneId: uuid('scene_id')
		.references(() => scenes.id, { onDelete: 'cascade' })
		.notNull()
		.unique(),
	// Scene configuration data from publisher store
	environment: json('environment').$type<EnvironmentProps>(), // environmentAtom data
	controls: json('controls').$type<ControlsProps>(), // controlsAtom data
	shadows: json('shadows').$type<ShadowsProps>(), // shadowsAtom data
	meta: json('meta').$type<SceneMeta>(), // metaAtom data (scene name, thumbnail, etc.)
	// Audit fields
	createdAt: timestamp('created_at').defaultNow().notNull(),
	createdBy: uuid('created_by')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull()
})
