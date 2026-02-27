import { sql } from 'drizzle-orm'
import { index, pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { assets } from './assets'
import { sceneSettings } from './scene-settings'
import { scenes } from './scenes'
import { users } from '../core/users'
import { canAccessScene, canManageScene, isUserSelf } from '../rls'

export const scenePublished = pgTable(
	'scene_published',
	{
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
	},
	(table) => [
		index('scene_published_asset_id_idx').on(table.assetId),
		index('scene_published_scene_settings_id_idx').on(table.sceneSettingsId),
		index('scene_published_published_by_idx').on(table.publishedBy),
		pgPolicy('scene_published_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: canAccessScene(table.sceneId)
		}),
		pgPolicy('scene_published_insert_project_member_self_publisher', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`
				${canAccessScene(table.sceneId)}
				and ${isUserSelf(table.publishedBy)}
				and exists (
					select 1
					from assets a
					join folders f on f.id = a.folder_id
					join projects p on p.id = f.project_id
					join scenes s on s.project_id = p.id
					join organization_memberships om on om.organization_id = p.organization_id
					where s.id = ${table.sceneId}
						and a.id = ${table.assetId}
						and om.user_id = ${authUid}
				)
			`
		}),
		pgPolicy('scene_published_update_project_member', {
			for: 'update',
			to: authenticatedRole,
			using: canAccessScene(table.sceneId),
			withCheck: canAccessScene(table.sceneId)
		}),
		pgPolicy('scene_published_delete_project_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageScene(table.sceneId)
		})
	]
).enableRLS()
