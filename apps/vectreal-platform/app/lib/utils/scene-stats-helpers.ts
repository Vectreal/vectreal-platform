import type { OptimizationReport } from '@vctrl/core'

import type { sceneStats } from '../../db/schema'

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
 * @param options - Optional metadata (label, description, totalSceneSize, totalTextureSize)
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
 *   { label: 'after-simplification', totalSceneSize: 5242880 }
 * )
 *
 * await db.insert(sceneStats).values(statsData)
 */
export function createSceneStatsFromReport(
	report: OptimizationReport,
	sceneId: string,
	userId: string,
	options?: {
		label?: string
		description?: string
		totalSceneSize?: number
		totalTextureSize?: number
		version?: number
	}
): Omit<InsertSceneStats, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		sceneId,
		createdBy: userId,
		version: options?.version ?? 1,
		label: options?.label,
		description: options?.description,

		// File size metrics
		totalSceneSize: options?.totalSceneSize,
		originalSize: report.originalSize,
		optimizedSize: report.optimizedSize,
		compressionRatio: report.compressionRatio.toString(),

		// Texture metrics
		totalTextureSize: options?.totalTextureSize,
		textureCountBefore: report.stats.textures.before,
		textureCountAfter: report.stats.textures.after,
		textureCount: report.stats.textures.after,

		// Vertex metrics
		vertexCountBefore: report.stats.vertices.before,
		vertexCountAfter: report.stats.vertices.after,
		vertexCount: report.stats.vertices.after,

		// Polygon/Triangle metrics
		polygonCountBefore: report.stats.triangles.before,
		polygonCountAfter: report.stats.triangles.after,
		polygonCount: report.stats.triangles.after,

		// Material metrics
		materialCountBefore: report.stats.materials.before,
		materialCountAfter: report.stats.materials.after,
		materialCount: report.stats.materials.after,

		// Mesh metrics
		meshCountBefore: report.stats.meshes.before,
		meshCountAfter: report.stats.meshes.after,
		meshCount: report.stats.meshes.after,

		// Node metrics
		nodeCountBefore: report.stats.nodes.before,
		nodeCountAfter: report.stats.nodes.after,
		nodeCount: report.stats.nodes.after,

		// Applied optimizations
		appliedOptimizations: report.appliedOptimizations,

		// Optimization settings (optional, null if not available)
		optimizationSettings: null,

		// Additional metrics (optional, null if not available)
		additionalMetrics: null
	}
}

/**
 * Creates initial scene stats before any optimizations have been applied.
 * Useful for establishing a baseline snapshot.
 *
 * @param report - The initial optimization report (before optimizations)
 * @param sceneId - The UUID of the scene
 * @param userId - The UUID of the user
 * @param options - Optional metadata
 * @returns Scene stats object with 'initial' label and matching before/after values
 *
 * @example
 * const optimizer = useOptimizeModel()
 * await optimizer.load(scene)
 *
 * const initialStats = createInitialSceneStats(
 *   optimizer.report,
 *   sceneId,
 *   userId,
 *   { totalSceneSize: 5242880 }
 * )
 *
 * await db.insert(sceneStats).values(initialStats)
 */
export function createInitialSceneStats(
	report: OptimizationReport,
	sceneId: string,
	userId: string,
	options?: {
		totalSceneSize?: number
		totalTextureSize?: number
		description?: string
	}
): Omit<InsertSceneStats, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		sceneId,
		createdBy: userId,
		version: 1,
		label: 'initial',
		description:
			options?.description ?? 'Initial scene state before optimization',

		// File size metrics
		totalSceneSize: options?.totalSceneSize,
		originalSize: report.originalSize,
		optimizedSize: report.originalSize, // Same as original for initial state
		compressionRatio: '1.0', // No compression yet

		// Texture metrics
		totalTextureSize: options?.totalTextureSize,
		textureCountBefore: report.stats.textures.before,
		textureCountAfter: report.stats.textures.before,
		textureCount: report.stats.textures.before,

		// Vertex metrics
		vertexCountBefore: report.stats.vertices.before,
		vertexCountAfter: report.stats.vertices.before,
		vertexCount: report.stats.vertices.before,

		// Polygon/Triangle metrics
		polygonCountBefore: report.stats.triangles.before,
		polygonCountAfter: report.stats.triangles.before,
		polygonCount: report.stats.triangles.before,

		// Material metrics
		materialCountBefore: report.stats.materials.before,
		materialCountAfter: report.stats.materials.before,
		materialCount: report.stats.materials.before,

		// Mesh metrics
		meshCountBefore: report.stats.meshes.before,
		meshCountAfter: report.stats.meshes.before,
		meshCount: report.stats.meshes.before,

		// Node metrics
		nodeCountBefore: report.stats.nodes.before,
		nodeCountAfter: report.stats.nodes.before,
		nodeCount: report.stats.nodes.before,

		// No optimizations applied yet
		appliedOptimizations: [],

		// Optimization settings (none for initial state)
		optimizationSettings: null,

		// Additional metrics (optional)
		additionalMetrics: null
	}
}

/**
 * Calculates the total reduction in various metrics between two stat snapshots.
 * Useful for comparing initial vs final state, or any two optimization snapshots.
 *
 * @param before - Earlier scene stats snapshot
 * @param after - Later scene stats snapshot
 * @returns Object containing absolute and percentage reductions
 *
 * @example
 * const initial = await db.query.sceneStats.findFirst({
 *   where: eq(sceneStats.label, 'initial')
 * })
 * const final = await db.query.sceneStats.findFirst({
 *   where: eq(sceneStats.label, 'final')
 * })
 *
 * const improvements = calculateImprovement(initial, final)
 * console.log(`File size reduced by ${improvements.fileSizeReduction.percentage}%`)
 */
export function calculateImprovement(
	before: SelectSceneStats,
	after: SelectSceneStats
) {
	const calculateReduction = (
		beforeVal: number | bigint | null | undefined,
		afterVal: number | bigint | null | undefined
	) => {
		const beforeNum = beforeVal ? Number(beforeVal) : 0
		const afterNum = afterVal ? Number(afterVal) : 0

		if (beforeNum === 0) {
			return { absolute: 0, percentage: 0 }
		}

		const absolute = beforeNum - afterNum
		const percentage = (absolute / beforeNum) * 100

		return { absolute, percentage: Math.round(percentage * 100) / 100 }
	}

	return {
		fileSizeReduction: calculateReduction(
			before.optimizedSize,
			after.optimizedSize
		),
		vertexReduction: calculateReduction(before.vertexCount, after.vertexCount),
		polygonReduction: calculateReduction(
			before.polygonCount,
			after.polygonCount
		),
		textureReduction: calculateReduction(
			before.textureCount,
			after.textureCount
		),
		materialReduction: calculateReduction(
			before.materialCount,
			after.materialCount
		),
		meshReduction: calculateReduction(before.meshCount, after.meshCount)
	}
}

/**
 * Formats file size in bytes to a human-readable string.
 *
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(
	bytes: number | bigint | null | undefined,
	decimals = 2
): string {
	if (!bytes || bytes === 0) return '0 Bytes'

	const k = 1024
	const dm = decimals < 0 ? 0 : decimals
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

	const bytesNum = Number(bytes)
	const i = Math.floor(Math.log(bytesNum) / Math.log(k))

	return `${parseFloat((bytesNum / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Formats large numbers with thousand separators.
 *
 * @param value - Number to format
 * @returns Formatted string (e.g., "1,234,567")
 */
export function formatNumber(
	value: number | bigint | null | undefined
): string {
	if (value === null || value === undefined) return '0'
	return Number(value).toLocaleString()
}
