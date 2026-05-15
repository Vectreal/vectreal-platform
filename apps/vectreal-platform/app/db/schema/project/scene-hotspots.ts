import { sql } from 'drizzle-orm'
import {
	boolean,
	index,
	integer,
	pgPolicy,
	pgTable,
	real,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { sceneSettings } from './scene-settings'
import { canAccessScene, canManageScene } from '../rls'

import type { HotspotStylePreset } from '@vctrl/core'

/**
 * Persists hotspot definitions for a scene.
 * Each row represents one hotspot anchored to a world-space position.
 * internalOnly hotspots are excluded from published/embed runtime payloads
 * but are always retained for re-editing.
 */
export const sceneHotspots = pgTable(
	'scene_hotspots',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sceneSettingsId: uuid('scene_settings_id')
			.references(() => sceneSettings.id, { onDelete: 'cascade' })
			.notNull(),

		name: text('name').notNull(),

		// World-space position stored as three real columns for direct querying.
		worldPositionX: real('world_position_x').notNull().default(0),
		worldPositionY: real('world_position_y').notNull().default(0),
		worldPositionZ: real('world_position_z').notNull().default(0),

		// Linked camera (kind='hotspot') from CameraProps.cameras.
		linkedCameraId: text('linked_camera_id'),

		visible: boolean('visible').notNull().default(true),
		internalOnly: boolean('internal_only').notNull().default(false),

		// 0-based sequence position; null means not in any sequence.
		sequenceIndex: integer('sequence_index'),

		stylePreset: text('style_preset')
			.$type<HotspotStylePreset>()
			.notNull()
			.default('dot'),

		// URL or inline data URI for image/svg presets.
		payloadUrl: text('payload_url'),

		// Audit fields
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('scene_hotspots_scene_settings_id_idx').on(table.sceneSettingsId),
		index('scene_hotspots_sequence_index_idx').on(
			table.sceneSettingsId,
			table.sequenceIndex
		),
		pgPolicy('scene_hotspots_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from scene_settings ss
					where ss.id = ${table.sceneSettingsId}
						and ${canAccessScene(sql`ss.scene_id`)}
				)
			`
		}),
		pgPolicy('scene_hotspots_insert_project_member', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`
				exists (
					select 1
					from scene_settings ss
					where ss.id = ${table.sceneSettingsId}
						and ${canAccessScene(sql`ss.scene_id`)}
				)
			`
		}),
		pgPolicy('scene_hotspots_update_project_member', {
			for: 'update',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from scene_settings ss
					where ss.id = ${table.sceneSettingsId}
						and ${canAccessScene(sql`ss.scene_id`)}
				)
			`,
			withCheck: sql`
				exists (
					select 1
					from scene_settings ss
					where ss.id = ${table.sceneSettingsId}
						and ${canAccessScene(sql`ss.scene_id`)}
				)
			`
		}),
		pgPolicy('scene_hotspots_delete_project_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: sql`
				exists (
					select 1
					from scene_settings ss
					where ss.id = ${table.sceneSettingsId}
						and ${canManageScene(sql`ss.scene_id`)}
				)
			`
		})
	]
).enableRLS()
