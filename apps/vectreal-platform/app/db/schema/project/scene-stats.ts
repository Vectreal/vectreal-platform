import { Optimizations } from '@vctrl/core'
import {
	bigint,
	integer,
	json,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { users } from '../core/users'

import { scenes } from './scenes'

/**
 * Scene statistics table tracking optimization metrics and asset totals.
 * This table captures comprehensive performance and size metrics for scenes
 * during the optimization process in the publisher.
 *
 * Design considerations:
 * - Each scene can have multiple stat snapshots (before/after optimizations)
 * - Tracks applied optimization techniques for auditing
 * - Stores detailed mesh and texture metrics from vectreal hooks
 * - Uses appropriate numeric types for large file sizes and counts
 */
export const sceneStats = pgTable('scene_stats', {
	id: uuid('id').primaryKey().defaultRandom(),

	sceneId: uuid('scene_id')
		.references(() => scenes.id, { onDelete: 'cascade' })
		.notNull(),

	// Metadata
	version: integer('version').notNull().default(1),
	label: text('label'), // e.g., 'initial', 'after-simplification', 'final'
	description: text('description'), // Optional notes about this snapshot

	// File size metrics (in bytes)
	totalSceneSize: bigint('total_scene_size', { mode: 'number' }), // Total size of entire scene including all assets
	originalSize: bigint('original_size', { mode: 'number' }), // Size before optimization
	optimizedSize: bigint('optimized_size', { mode: 'number' }), // Size after optimization
	compressionRatio: numeric('compression_ratio', {
		precision: 5,
		scale: 4
	}), // Ratio of compression (e.g., 0.6543 = 65.43%)

	// Texture metrics
	totalTextureSize: bigint('total_texture_size', { mode: 'number' }), // Combined size of all textures in bytes
	textureCount: integer('texture_count'), // Number of textures
	textureCountBefore: integer('texture_count_before'), // Textures before optimization
	textureCountAfter: integer('texture_count_after'), // Textures after optimization

	// Mesh/Geometry metrics
	vertexCount: bigint('vertex_count', { mode: 'number' }), // Total vertex count
	vertexCountBefore: bigint('vertex_count_before', { mode: 'number' }), // Vertices before optimization
	vertexCountAfter: bigint('vertex_count_after', { mode: 'number' }), // Vertices after optimization

	polygonCount: bigint('polygon_count', { mode: 'number' }), // Total polygon/triangle count
	polygonCountBefore: bigint('polygon_count_before', { mode: 'number' }), // Polygons before optimization
	polygonCountAfter: bigint('polygon_count_after', { mode: 'number' }), // Polygons after optimization

	// Material metrics
	materialCount: integer('material_count'), // Number of materials
	materialCountBefore: integer('material_count_before'),
	materialCountAfter: integer('material_count_after'),

	// Mesh metrics
	meshCount: integer('mesh_count'), // Number of meshes
	meshCountBefore: integer('mesh_count_before'),
	meshCountAfter: integer('mesh_count_after'),

	// Node metrics (scene graph complexity)
	nodeCount: integer('node_count'), // Number of nodes in scene graph
	nodeCountBefore: integer('node_count_before'),
	nodeCountAfter: integer('node_count_after'),

	// Applied optimizations tracking
	appliedOptimizations: json('applied_optimizations').$type<string[]>(), // Array of optimization names applied

	// Detailed optimization settings used
	optimizationSettings: json('optimization_settings').$type<Optimizations>(),

	// Additional metrics that might be useful
	additionalMetrics: json('additional_metrics').$type<{
		meshesSize?: number // Total size of mesh data
		accessorSize?: number // Total size of accessor data
		bufferSize?: number // Total buffer size
		imageSize?: number // Total image data size
		[key: string]: unknown // Allow for future extensibility
	}>(),

	// Audit fields
	createdAt: timestamp('created_at').defaultNow().notNull(),
	createdBy: uuid('created_by')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
})
