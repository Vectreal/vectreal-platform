import { formatFileSize } from '@shared/utils'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'

import type { SizeInfo } from './use-optimization-process'
import type { SceneStatsData } from '../../../../types/api'
import type { OptimizationReport } from '@vctrl/core'

interface BuildSceneMetricsParams {
	info: OptimizationInfo
	report?: OptimizationReport | null
	sizeInfo: SizeInfo
	stats?: SceneStatsData | null
}

export interface SceneMetrics {
	vertexInitial: number
	vertexOptimized: number
	triangleInitial: number
	triangleOptimized: number
	meshInitial: number
	meshOptimized: number
	textureSizeInitial: number | null
	textureSizeOptimized: number | null
	textureCountInitial: number | null
	textureCountOptimized: number | null
	textureResolutionsInitial: string[]
	textureResolutionsOptimized: string[]
	sceneBytesInitial: number | null
	sceneBytesCurrent: number | null
}

export function buildSceneMetrics({
	info,
	report,
	sizeInfo,
	stats
}: BuildSceneMetricsParams): SceneMetrics {
	const persistedInitialSceneBytes = stats?.initialSceneBytes ?? null
	const persistedCurrentSceneBytes = stats?.currentSceneBytes ?? null

	const textureSizeInitial =
		sizeInfo.initialTextureBytes ?? report?.stats.textures.before ?? null
	const textureSizeOptimized =
		sizeInfo.currentTextureBytes ??
		report?.stats.textures.after ??
		textureSizeInitial
	const textureCountInitial =
		stats?.baseline?.texturesCount ?? report?.stats.texturesCount?.before ?? null
	const textureCountOptimized =
		stats?.optimized?.texturesCount ??
		report?.stats.texturesCount?.after ??
		textureCountInitial
	const textureResolutionsInitial = report?.stats.textureResolutions?.before ?? []
	const textureResolutionsOptimized =
		report?.stats.textureResolutions?.after ?? []

	const sceneBytesInitial =
		sizeInfo.initialSceneBytes ?? persistedInitialSceneBytes
	const sceneBytesCurrent =
		sizeInfo.currentSceneBytes ?? persistedCurrentSceneBytes ?? sceneBytesInitial

	return {
		vertexInitial: stats?.baseline?.verticesCount ?? info.initial.verticesCount,
		vertexOptimized:
			stats?.optimized?.verticesCount ?? info.optimized.verticesCount,
		triangleInitial:
			stats?.baseline?.primitivesCount ?? info.initial.primitivesCount,
		triangleOptimized:
			stats?.optimized?.primitivesCount ?? info.optimized.primitivesCount,
		meshInitial: stats?.baseline?.meshesCount ?? info.initial.meshesCount,
		meshOptimized: stats?.optimized?.meshesCount ?? info.optimized.meshesCount,
		textureSizeInitial,
		textureSizeOptimized,
		textureCountInitial,
		textureCountOptimized,
		textureResolutionsInitial,
		textureResolutionsOptimized,
		sceneBytesInitial,
		sceneBytesCurrent
	}
}

export function formatMetricCount(value: number | null) {
	return value === null ? '—' : value.toLocaleString()
}

export function formatMetricBytes(value: number | null) {
	return value === null ? '—' : formatFileSize(value)
}

export function formatMetricResolutions(values: string[]) {
	return values.join(', ')
}
