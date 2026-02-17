import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from '../core/users'

import { assets } from './assets'
import { sceneSettings } from './scene-settings'
import { scenes } from './scenes'

export const scenePublished = pgTable('scene_published', {
	sceneId: uuid('scene_id')
		.primaryKey()
		.references(() => scenes.id, { onDelete: 'cascade' }),
	assetId: uuid('asset_id')
		.references(() => assets.id, { onDelete: 'cascade' })
		.notNull(),
	sceneSettingsId: uuid('scene_settings_id').references(
		() => sceneSettings.id,
		{
			onDelete: 'set null'
		}
	),
	publishedAt: timestamp('published_at').defaultNow().notNull(),
	publishedBy: uuid('published_by')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull()
})
