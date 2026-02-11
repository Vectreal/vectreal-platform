import type {
	DedupOptimization,
	NormalsOptimization,
	QuantizeOptimization,
	SimplificationOptimization,
	TextureOptimization
} from '@vctrl/core'
import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { useLatestSceneStats } from '../../../../hooks/use-scene-stats'
import { optimizationAtom } from '../../../../lib/stores/publisher-config-store'

export type SizeInfo = {
	draftBytes?: number | null
	draftAfterBytes?: number | null
	publishedBytes?: number | null
}

type OptimizationOption =
	| SimplificationOptimization
	| TextureOptimization
	| QuantizeOptimization
	| DedupOptimization
	| NormalsOptimization

/**
 * Custom hook that encapsulates the optimization logic and state management
 */
export const useOptimizationProcess = () => {
	const { optimizer, on, off, file } = useModelContext(true)
	const {
		reset: resetOptimize,
		applyOptimization,
		simplifyOptimization,
		texturesOptimization,
		quantizeOptimization,
		dedupOptimization,
		normalsOptimization,
		info,
		report
	} = optimizer
	const params = useParams()
	const sceneId = typeof params.sceneId === 'string' ? params.sceneId : ''
	const { stats } = useLatestSceneStats(sceneId, Boolean(sceneId))

	const { optimizations: plannedOptimizations } = useAtomValue(optimizationAtom)
	const [isPending, setIsPending] = useState<boolean>(false)
	const [draftAfterBytes, setDraftAfterBytes] = useState<number | null>(null)
	const { handleDocumentGltfExport } = useExportModel()

	const calculateDraftBytes = useCallback(async () => {
		const document = optimizer?._getDocument?.()
		if (!document) return null
		const result = await handleDocumentGltfExport(document, file, false, false)
		if (result && typeof result === 'object' && 'size' in result) {
			return (result as { size?: number }).size ?? null
		}
		return null
	}, [optimizer, handleDocumentGltfExport, file])

	// Handle optimization process
	const handleOptimizeClick = useCallback(async () => {
		if (isPending) return

		setIsPending(true)

		try {
			const optimizationOptions = Object.values(plannedOptimizations).filter(
				(option): option is OptimizationOption => !!option && option.enabled
			)

			for (let i = 0; i < optimizationOptions.length; i++) {
				const option = optimizationOptions[i]

				try {
					// Apply single optimization based on option type
					if (option.name === 'simplification') {
						await simplifyOptimization(option)
					} else if (option.name === 'texture') {
						await texturesOptimization(option)
					} else if (option.name === 'quantize') {
						await quantizeOptimization()
					} else if (option.name === 'dedup') {
						await dedupOptimization()
					} else if (option.name === 'normals') {
						await normalsOptimization()
					} else {
						// Use explicit type casting for exhaustiveness check
						const unknownOption = option as OptimizationOption
						console.warn(`Unknown optimization type: ${unknownOption.name}`)
					}

					// Let UI update between optimizations
					await new Promise<void>((resolve) =>
						requestAnimationFrame(() => setTimeout(() => resolve(), 0))
					)
				} catch (error) {
					console.error(`Error processing ${option.name}:`, error)
				}
			}

			// Apply all optimizations
			await applyOptimization()
			const updatedDraftBytes = await calculateDraftBytes()
			if (typeof updatedDraftBytes === 'number') {
				setDraftAfterBytes(updatedDraftBytes)
			}
		} catch (error) {
			console.error('Error during optimization:', error)
		} finally {
			setIsPending(false)
		}
	}, [
		isPending,
		calculateDraftBytes,
		plannedOptimizations,
		applyOptimization,
		simplifyOptimization,
		texturesOptimization,
		quantizeOptimization,
		dedupOptimization,
		normalsOptimization
	])

	// Reset on model load
	useEffect(() => {
		const handleReset = () => setDraftAfterBytes(null)
		on('load-start', resetOptimize)
		on('load-start', handleReset)
		return () => {
			off('load-start', resetOptimize)
			off('load-start', handleReset)
		}
	}, [off, on, resetOptimize])

	const sizeInfo: SizeInfo = {
		draftBytes: stats?.draftBytes ?? info.initial.sceneBytes,
		draftAfterBytes: draftAfterBytes ?? null,
		publishedBytes: stats?.publishedBytes ?? null
	}
	const initialDraftBytes = sizeInfo.draftBytes ?? info.initial.sceneBytes
	const optimizedDraftBytes =
		sizeInfo.draftAfterBytes ?? info.optimized.sceneBytes
	const hasImproved =
		typeof initialDraftBytes === 'number' &&
		typeof optimizedDraftBytes === 'number'
			? optimizedDraftBytes < initialDraftBytes
			: false

	return {
		info,
		report,
		isPending,
		hasImproved,
		sizeInfo,
		handleOptimizeClick
	}
}
