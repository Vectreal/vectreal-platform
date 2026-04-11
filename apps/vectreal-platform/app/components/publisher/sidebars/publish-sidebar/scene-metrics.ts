import { formatFileSize } from '@shared/utils'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'

import type { SceneStatsData } from '../../../../types/api'
import type { SizeInfo } from '../optimize-sidebar/use-optimization-process'
import type { OptimizationReport } from '@vctrl/core'

interface BuildSceneMetricsParams {
	info: OptimizationInfo
	report?: OptimizationReport | null
	sizeInfo: SizeInfo
	stats?: SceneStatsData | null
}

export interface SceneMetrics {
	vertexInitial: number | null
	vertexOptimized: number | null
	triangleInitial: number | null
	triangleOptimized: number | null
	meshInitial: number | null
	meshOptimized: number | null
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
	const resolveCountMetric = ({
		persisted,
		reportValue,
		infoValue,
		relatedPersisted
	}: {
		persisted?: number | null
		reportValue?: number
		infoValue?: number
		relatedPersisted?: number | null
	}): number | null => {
		const reportCandidate =
			typeof reportValue === 'number' && reportValue >= 0 ? reportValue : null
		const infoCandidate =
			typeof infoValue === 'number' && infoValue >= 0 ? infoValue : null

		if (typeof persisted === 'number') {
			if (persisted > 0) {
				return persisted
			}

			if (persisted === 0) {
				if (reportCandidate !== null && reportCandidate > 0) {
					return reportCandidate
				}

				if (infoCandidate !== null && infoCandidate > 0) {
					return infoCandidate
				}

				if (typeof relatedPersisted === 'number' && relatedPersisted > 0) {
					return null
				}

				return 0
			}
		}

		return reportCandidate ?? infoCandidate ?? null
	}

	const persistedInitialSceneBytes = stats?.initialSceneBytes ?? null
	const persistedCurrentSceneBytes = stats?.currentSceneBytes ?? null

	const textureSizeInitial =
		sizeInfo.initialTextureBytes ?? report?.stats.textures.before ?? null
	const textureSizeOptimized =
		sizeInfo.currentTextureBytes ??
		report?.stats.textures.after ??
		textureSizeInitial
	const textureCountInitial =
		stats?.baseline?.texturesCount ??
		report?.stats.texturesCount?.before ??
		null
	const textureCountOptimized =
		stats?.optimized?.texturesCount ??
		report?.stats.texturesCount?.after ??
		textureCountInitial
	const textureResolutionsInitial =
		report?.stats.textureResolutions?.before ?? []
	const textureResolutionsOptimized =
		report?.stats.textureResolutions?.after ?? []

	const sceneBytesInitial =
		persistedInitialSceneBytes ?? sizeInfo.initialSceneBytes ?? null
	const sceneBytesCurrent =
		persistedCurrentSceneBytes ??
		sizeInfo.currentSceneBytes ??
		sceneBytesInitial ??
		null

	const vertexInitial = resolveCountMetric({
		persisted: stats?.baseline?.verticesCount,
		reportValue: report?.stats.vertices.before,
		infoValue: info.initial.verticesCount,
		relatedPersisted: stats?.optimized?.verticesCount
	})
	const vertexOptimized = resolveCountMetric({
		persisted: stats?.optimized?.verticesCount,
		reportValue: report?.stats.vertices.after,
		infoValue: info.optimized.verticesCount,
		relatedPersisted: stats?.baseline?.verticesCount
	})
	const triangleInitial = resolveCountMetric({
		persisted: stats?.baseline?.primitivesCount,
		reportValue: report?.stats.triangles.before,
		infoValue: info.initial.primitivesCount,
		relatedPersisted: stats?.optimized?.primitivesCount
	})
	const triangleOptimized = resolveCountMetric({
		persisted: stats?.optimized?.primitivesCount,
		reportValue: report?.stats.triangles.after,
		infoValue: info.optimized.primitivesCount,
		relatedPersisted: stats?.baseline?.primitivesCount
	})
	const meshInitial = resolveCountMetric({
		persisted: stats?.baseline?.meshesCount,
		reportValue: report?.stats.meshes.before,
		infoValue: info.initial.meshesCount,
		relatedPersisted: stats?.optimized?.meshesCount
	})
	const meshOptimized = resolveCountMetric({
		persisted: stats?.optimized?.meshesCount,
		reportValue: report?.stats.meshes.after,
		infoValue: info.optimized.meshesCount,
		relatedPersisted: stats?.baseline?.meshesCount
	})

	return {
		vertexInitial,
		vertexOptimized,
		triangleInitial,
		triangleOptimized,
		meshInitial,
		meshOptimized,
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
