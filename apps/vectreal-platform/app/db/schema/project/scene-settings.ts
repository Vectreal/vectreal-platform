import {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	ShadowsProps
} from '@vctrl/core'
import { sql } from 'drizzle-orm'
import {
	index,
	pgPolicy,
	json,
	pgTable,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { scenes } from './scenes'
import { users } from '../core/users'
import { canAccessScene, canManageScene, isUserSelf } from '../rls'

export const sceneSettings = pgTable(
	'scene_settings',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sceneId: uuid('scene_id')
			.references(() => scenes.id, { onDelete: 'cascade' })
			.notNull()
			.unique(),

		// Scene configuration data from publisher store
		bounds: json('bounds').$type<BoundsProps>(), // boundsAtom data
		camera: json('camera').$type<CameraProps>(), // cameraAtom data
		controls: json('controls').$type<ControlsProps>(), // controlsAtom data
		environment: json('environment').$type<EnvironmentProps>(), // environmentAtom data
		shadows: json('shadows').$type<ShadowsProps>(), // shadowsAtom data

		// Audit fields
		createdAt: timestamp('created_at').defaultNow().notNull(),
		createdBy: uuid('created_by')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		index('scene_settings_created_by_idx').on(table.createdBy),
		pgPolicy('scene_settings_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: canAccessScene(table.sceneId)
		}),
		pgPolicy('scene_settings_insert_project_member_self_creator', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`${canAccessScene(table.sceneId)} and ${isUserSelf(table.createdBy)}`
		}),
		pgPolicy('scene_settings_update_project_member', {
			for: 'update',
			to: authenticatedRole,
			using: canAccessScene(table.sceneId),
			withCheck: canAccessScene(table.sceneId)
		}),
		pgPolicy('scene_settings_delete_project_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageScene(table.sceneId)
		})
	]
).enableRLS()
