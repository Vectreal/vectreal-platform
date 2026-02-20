import { Optimizations } from '@vctrl/core'
import {
	integer,
	json,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { users } from '../core/users'

import { scenes } from './scenes'

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
export const sceneStats = pgTable('scene_stats', {
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
})
