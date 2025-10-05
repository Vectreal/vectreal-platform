import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useState } from 'react'

import { optimizationAtom } from '../../../../lib/stores/publisher-config-store'
import type {
	DedupOptimization,
	NormalsOptimization,
	QuantizeOptimization,
	SimplificationOptimization,
	TextureOptimization
} from '../../../../types/publisher-config'

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
	const { optimizer, on, off } = useModelContext(true)
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

	const { plannedOptimizations } = useAtomValue(optimizationAtom)
	const [isPending, setIsPending] = useState<boolean>(false)

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
		} catch (error) {
			console.error('Error during optimization:', error)
		} finally {
			setIsPending(false)
		}
	}, [
		isPending,
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
		on('load-start', resetOptimize)
		return () => off('load-start', resetOptimize)
	}, [off, on, resetOptimize])

	const hasImproved = info.optimized.sceneBytes < info.initial.sceneBytes

	return {
		info,
		report,
		isPending,
		hasImproved,
		handleOptimizeClick
	}
}
