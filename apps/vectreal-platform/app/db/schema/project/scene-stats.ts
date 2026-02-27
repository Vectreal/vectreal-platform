import { Optimizations } from '@vctrl/core'
import { sql } from 'drizzle-orm'
import {
	index,
	integer,
	json,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { scenes } from './scenes'
import { users } from '../core/users'
import { canAccessScene, canManageScene, isUserSelf } from '../rls'

export type SceneStatsSnapshot = {
	verticesCount?: number
	primitivesCount?: number
	meshesCount?: number
	texturesCount?: number
	materialsCount?: number
	nodesCount?: number
}

/**
 * Scene statistics table tracking baseline and optimized metrics.
 * Each record stores a baseline snapshot and its optimized counterpart.
 */
export const sceneStats = pgTable(
	'scene_stats',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		sceneId: uuid('scene_id')
			.references(() => scenes.id, { onDelete: 'cascade' })
			.notNull()
			.unique(),

		// Metadata
		label: text('label'),
		description: text('description'),

		// Baseline vs optimized snapshots
		baseline: json('baseline').$type<SceneStatsSnapshot>(),
		optimized: json('optimized').$type<SceneStatsSnapshot>(),

		// Unified scene size snapshots (before and after optimization)
		initialSceneBytes: integer('initial_scene_bytes'),
		currentSceneBytes: integer('current_scene_bytes'),

		// Applied optimizations tracking
		appliedOptimizations: json('applied_optimizations').$type<string[]>(), // Array of optimization names applied

		// Detailed optimization settings used
		optimizationSettings: json('optimization_settings').$type<Optimizations>(),

		// Additional metrics that might be useful
		additionalMetrics: json('additional_metrics').$type<{
			[key: string]: unknown
		}>(),

		// Audit fields
		createdAt: timestamp('created_at').defaultNow().notNull(),
		createdBy: uuid('created_by')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('scene_stats_created_by_idx').on(table.createdBy),
		pgPolicy('scene_stats_select_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: canAccessScene(table.sceneId)
		}),
		pgPolicy('scene_stats_insert_project_member_self_creator', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`${canAccessScene(table.sceneId)} and ${isUserSelf(table.createdBy)}`
		}),
		pgPolicy('scene_stats_update_project_member', {
			for: 'update',
			to: authenticatedRole,
			using: canAccessScene(table.sceneId),
			withCheck: canAccessScene(table.sceneId)
		}),
		pgPolicy('scene_stats_delete_project_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageScene(table.sceneId)
		})
	]
).enableRLS()
