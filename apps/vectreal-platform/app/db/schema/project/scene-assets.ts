import { sql } from 'drizzle-orm'
import {
	index,
	pgPolicy,
	pgTable,
	primaryKey,
	timestamp,
	uuid,
	varchar
} from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { assets } from './assets'
import { sceneSettings } from './scene-settings'
import { canAccessAsset } from '../rls'

export const sceneAssets = pgTable(
	'scene_assets',
	{
		sceneSettingsId: uuid('scene_settings_id')
			.references(() => sceneSettings.id, { onDelete: 'cascade' })
			.notNull(),
		assetId: uuid('asset_id')
			.references(() => assets.id, { onDelete: 'cascade' })
			.notNull(),
		usageType: varchar('usage_type', { length: 50 }), // 'texture', 'material', 'model', etc.
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.sceneSettingsId, table.assetId] }),
		index('scene_assets_scene_settings_id_idx').on(table.sceneSettingsId),
		index('scene_assets_asset_id_idx').on(table.assetId),
		pgPolicy('scene_assets_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from scene_settings ss
					join scenes s on s.id = ss.scene_id
					join projects p on p.id = s.project_id
					join organization_memberships om on om.organization_id = p.organization_id
					where ss.id = ${table.sceneSettingsId}
						and om.user_id = ${authUid}
				)
			`
		}),
		pgPolicy('scene_assets_insert_project_member', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`
				${canAccessAsset(table.assetId)}
				and exists (
					select 1
					from scene_settings ss
					join scenes s on s.id = ss.scene_id
					join projects p on p.id = s.project_id
					join organization_memberships om on om.organization_id = p.organization_id
					where ss.id = ${table.sceneSettingsId}
						and om.user_id = ${authUid}
				)
			`
		}),
		pgPolicy('scene_assets_delete_project_member', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from scene_settings ss
					join scenes s on s.id = ss.scene_id
					join projects p on p.id = s.project_id
					join organization_memberships om on om.organization_id = p.organization_id
					where ss.id = ${table.sceneSettingsId}
						and om.user_id = ${authUid}
				)
			`
		})
	]
).enableRLS()
