import {
	InspectMeshReport,
	InspectTextureReport
} from '@gltf-transform/functions'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { OptimizationInfo, OptimizationState } from './types'

/**
 * Helper function to sum a specific property over an array of objects.
 */
function sumProperty<K extends string>(
	items: Record<K, number>[] | undefined,
	property: K
): number {
	if (!items) return 0
	return items.reduce((total, item) => total + (item[property] || 0), 0)
}

export interface OptimizationInfoData {
	info: OptimizationInfo
	reset: () => void
}

export const useCalcOptimizationInfo = (
	state: OptimizationState
): OptimizationInfoData => {
	const initialReport = useRef<Pick<OptimizationState, 'report'>>(state)
	const [initialCaptured, setInitialCaptured] = useState<boolean>(false)
	const report = state.report

	// Capture initial state
	useEffect(() => {
		if (!initialCaptured && report) {
			initialReport.current = { report }
			setInitialCaptured(true)
		}
	}, [initialCaptured, report])

	const info = useMemo(() => {
		const initial = initialReport.current

		// Initial stats
		const initialVerticesTotal = sumProperty(
			initial?.report?.meshes?.properties as InspectMeshReport[],
			'vertices'
		)

		const initialPrimitivesTotal = sumProperty(
			initial?.report?.meshes?.properties as InspectMeshReport[],
			'glPrimitives'
		)

		const initialMeshesSizeTotal = sumProperty(
			initial?.report?.meshes?.properties as InspectMeshReport[],
			'size'
		)

		const initialTexturesSizeTotal = sumProperty(
			initial?.report?.textures?.properties as InspectTextureReport[],
			'size'
		)

		const totalBytes = initialMeshesSizeTotal + initialTexturesSizeTotal

		// Current stats
		const currentVerticesTotal = sumProperty(
			report?.meshes?.properties as InspectMeshReport[],
			'vertices'
		)

		const currentPrimitivesTotal = sumProperty(
			report?.meshes?.properties as InspectMeshReport[],
			'glPrimitives'
		)

		const currentMeshesSizeTotal = sumProperty(
			report?.meshes?.properties as InspectMeshReport[],
			'size'
		)

		const currentTexturesSizeTotal = sumProperty(
			report?.textures?.properties as InspectTextureReport[],
			'size'
		)

		const currentTotalBytes = currentMeshesSizeTotal + currentTexturesSizeTotal

		return {
			initial: {
				verticesCount: initialVerticesTotal,
				primitivesCount: initialPrimitivesTotal,
				meshesSize: initialMeshesSizeTotal,
				texturesSize: initialTexturesSizeTotal,
				sceneBytes: totalBytes
			},
			optimized: {
				verticesCount: currentVerticesTotal,
				primitivesCount: currentPrimitivesTotal,
				meshesSize: currentMeshesSizeTotal,
				texturesSize: currentTexturesSizeTotal,
				sceneBytes: currentTotalBytes
			},
			improvement: {
				verticesCount: initialVerticesTotal - currentVerticesTotal,
				primitivesCount: initialPrimitivesTotal - currentPrimitivesTotal,
				meshesSize: initialMeshesSizeTotal - currentMeshesSizeTotal,
				texturesSize: initialTexturesSizeTotal - currentTexturesSizeTotal,
				sceneBytes: totalBytes - currentTotalBytes
			}
		}
	}, [report])

	const reset = useCallback(() => {
		initialReport.current = { report: null }
		setInitialCaptured(false)
	}, [])

	return {
		info,
		reset
	}
}
