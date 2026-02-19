import type { OptimizationReport } from '@vctrl/core/model-optimizer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { OptimizationInfo, OptimizationState } from './types'

/**
 * Helper function to safely get stats from optimization report.
 */
function getStatsFromReport(report: OptimizationReport | null): {
	vertices: number
	primitives: number
	meshes: number
	textures: number
	materials: number
	totalSize: number
} {
	if (!report) {
		return {
			vertices: 0,
			primitives: 0,
			meshes: 0,
			textures: 0,
			materials: 0,
			totalSize: 0
		}
	}

	return {
		vertices: report.stats.vertices.after || 0,
		primitives: report.stats.triangles.after || 0,
		meshes: report.stats.meshes.after || 0,
		textures: report.stats.textures.after || 0,
		materials: report.stats.materials.after || 0,
		totalSize: report.optimizedSize || 0
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
		const initial = getStatsFromReport(initialReport.current)
		const current = getStatsFromReport(report)

		return {
			initial: {
				verticesCount: initial.vertices,
				primitivesCount: initial.primitives,
				meshesCount: initial.meshes,
				texturesCount: initial.textures,
				sceneBytes: initial.totalSize
			},
			optimized: {
				verticesCount: current.vertices,
				primitivesCount: current.primitives,
				meshesCount: current.meshes,
				texturesCount: current.textures,
				sceneBytes: current.totalSize
			},
			improvement: {
				verticesCount: initial.vertices - current.vertices,
				primitivesCount: initial.primitives - current.primitives,
				meshesCount: initial.meshes - current.meshes,
				texturesCount: initial.textures - current.textures,
				sceneBytes: initial.totalSize - current.totalSize
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
