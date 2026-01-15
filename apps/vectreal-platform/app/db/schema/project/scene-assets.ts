import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { assets } from './assets'
import { sceneSettings } from './scene-settings'

export const sceneAssets = pgTable('scene_assets', {
	sceneSettingsId: uuid('scene_settings_id')
		.references(() => sceneSettings.id, { onDelete: 'cascade' })
		.notNull()
		.primaryKey(),
	assetId: uuid('asset_id')
		.references(() => assets.id, { onDelete: 'cascade' })
		.notNull()
		.primaryKey(),
	usageType: varchar('usage_type', { length: 50 }), // 'texture', 'material', 'model', etc.
	createdAt: timestamp('created_at').defaultNow().notNull()
})
