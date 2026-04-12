import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { OptimizationInfo, OptimizationState } from './types'

import type { OptimizationReport } from '@vctrl/core/model-optimizer'

interface OptimizationMetricsSnapshot {
	verticesCount: number
	primitivesCount: number
	meshesCount: number
	textureAssetCount: number
	materialsCount: number
	sceneBytes: number
}

/**
 * Helper function to safely get stats from optimization report.
 */
function getSnapshotFromReport(
	report: OptimizationReport | null
): OptimizationMetricsSnapshot {
	if (!report) {
		return {
			verticesCount: 0,
			primitivesCount: 0,
			meshesCount: 0,
			textureAssetCount: 0,
			materialsCount: 0,
			sceneBytes: 0
		}
	}

	return {
		verticesCount: report.stats.vertices.after ?? 0,
		primitivesCount: report.stats.triangles.after ?? 0,
		meshesCount: report.stats.meshes.after ?? 0,
		textureAssetCount: report.stats.texturesCount.after ?? 0,
		materialsCount: report.stats.materials.after ?? 0,
		sceneBytes: report.optimizedSize ?? 0
	}
}

export interface OptimizationInfoData {
	info: OptimizationInfo
	reset: () => void
}

export const useCalcOptimizationInfo = (
	state: OptimizationState
): OptimizationInfoData => {
	const initialReport = useRef<OptimizationReport | null>(null)
	const [initialCaptured, setInitialCaptured] = useState<boolean>(false)
	const report = state.report

	// Capture initial state
	useEffect(() => {
		if (!initialCaptured && report) {
			initialReport.current = report
			setInitialCaptured(true)
		}
	}, [initialCaptured, report])

	const info = useMemo(() => {
		const initial = getSnapshotFromReport(initialReport.current)
		const current = getSnapshotFromReport(report)

		return {
			initial: {
				verticesCount: initial.verticesCount,
				primitivesCount: initial.primitivesCount,
				meshesCount: initial.meshesCount,
				texturesCount: initial.textureAssetCount,
				sceneBytes: initial.sceneBytes
			},
			optimized: {
				verticesCount: current.verticesCount,
				primitivesCount: current.primitivesCount,
				meshesCount: current.meshesCount,
				texturesCount: current.textureAssetCount,
				sceneBytes: current.sceneBytes
			},
			improvement: {
				verticesCount: initial.verticesCount - current.verticesCount,
				primitivesCount: initial.primitivesCount - current.primitivesCount,
				meshesCount: initial.meshesCount - current.meshesCount,
				texturesCount: initial.textureAssetCount - current.textureAssetCount,
				sceneBytes: initial.sceneBytes - current.sceneBytes
			}
		}
	}, [report])

	const reset = useCallback(() => {
		initialReport.current = null
		setInitialCaptured(false)
	}, [])

	return {
		info,
		reset
	}
}
