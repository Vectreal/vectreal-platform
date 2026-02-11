import type { OptimizationReport } from '@vctrl/core'

import type { sceneStats, SceneStatsSnapshot } from '../../db/schema'

/**
 * Helper type for inserting scene statistics.
 * Omits auto-generated fields like id, createdAt, and updatedAt.
 */
export type InsertSceneStats = typeof sceneStats.$inferInsert

/**
 * Helper type for selecting scene statistics from the database.
 */
export type SelectSceneStats = typeof sceneStats.$inferSelect

/**
 * Converts an OptimizationReport from @vctrl/core to scene stats data
 * suitable for database insertion.
 *
 * This helper extracts all relevant metrics from the optimization report
 * and formats them for storage in the scene_stats table.
 *
 * @param report - The optimization report from useOptimizeModel hook
 * @param sceneId - The UUID of the scene these stats belong to
 * @param userId - The UUID of the user creating the stats
 * @param options - Optional metadata (label, description)
 * @returns Partial scene stats object ready for database insertion
 *
 * @example
 * const optimizer = useOptimizeModel()
 * await optimizer.load(scene)
 * await optimizer.simplifyOptimization({ ratio: 0.5 })
 *
 * const report = optimizer.report
 * const statsData = createSceneStatsFromReport(
 *   report,
 *   sceneId,
 *   userId,
 *   { label: 'after-simplification' }
 * )
 *
 * await db.insert(sceneStats).values(statsData)
 */
function buildSceneStatsSnapshot(
	report: OptimizationReport,
	mode: 'baseline' | 'optimized'
): SceneStatsSnapshot {
	const isBaseline = mode === 'baseline'

	return {
		verticesCount: isBaseline
			? report.stats.vertices.before
			: report.stats.vertices.after,
		primitivesCount: isBaseline
			? report.stats.triangles.before
			: report.stats.triangles.after,
		meshesCount: isBaseline
			? report.stats.meshes.before
			: report.stats.meshes.after,
		texturesCount: isBaseline
			? report.stats.textures.before
			: report.stats.textures.after,
		materialsCount: isBaseline
			? report.stats.materials.before
			: report.stats.materials.after,
		nodesCount: isBaseline
			? report.stats.nodes.before
			: report.stats.nodes.after
	}
}

export function createSceneStatsFromReport(
	report: OptimizationReport,
	sceneId: string,
	userId: string,
	options?: {
		label?: string
		description?: string
		draftBytes?: number | null
	}
): Omit<InsertSceneStats, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		sceneId,
		createdBy: userId,
		label: options?.label,
		description: options?.description,
		baseline: buildSceneStatsSnapshot(report, 'baseline'),
		optimized: buildSceneStatsSnapshot(report, 'optimized'),
		draftBytes: options?.draftBytes ?? null,
		publishedBytes: null,
		appliedOptimizations: report.appliedOptimizations,
		optimizationSettings: null,
		additionalMetrics: null
	}
}

/**
 * Formats file size in bytes to a human-readable string.
 *
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB")
 */
