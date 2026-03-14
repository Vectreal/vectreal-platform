import type { SceneAggregateResponse } from '../../../../types/api'
import type {
	OptimizationPreset,
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

interface AggregateByteMetrics {
	sourcePackageBytes: null | number
	textureBytes: null | number
}

interface ExecuteOptimizationStateHydrationParams {
	aggregate: SceneAggregateResponse | null
	calculateAggregateReferencedBytes: (
		aggregate: SceneAggregateResponse | null
	) => AggregateByteMetrics
	inferOptimizationPreset: (optimizations: Optimizations) => OptimizationPreset
	setOptimizationState: (
		updater: (prev: OptimizationState) => OptimizationState
	) => void
	setOptimizationRuntime: (
		next:
			| SceneOptimizationRuntimeState
			| ((prev: SceneOptimizationRuntimeState) => SceneOptimizationRuntimeState)
	) => void
	optimizationRuntimeInitialState: SceneOptimizationRuntimeState
	mediumOptimizations: Optimizations
}

export const executeOptimizationStateHydration = ({
	aggregate,
	calculateAggregateReferencedBytes,
	inferOptimizationPreset,
	setOptimizationState,
	setOptimizationRuntime,
	optimizationRuntimeInitialState,
	mediumOptimizations
}: ExecuteOptimizationStateHydrationParams) => {
	const persistedOptimizationSettings = aggregate?.stats?.optimizationSettings
	const latestSceneStats = aggregate?.stats ?? null
	const { sourcePackageBytes, textureBytes } =
		calculateAggregateReferencedBytes(aggregate)

	if (!persistedOptimizationSettings) {
		setOptimizationState((prev) => ({
			...prev,
			optimizationPreset: 'medium',
			optimizations: mediumOptimizations
		}))

		setOptimizationRuntime({
			...optimizationRuntimeInitialState,
			isSceneSizeLoading: false,
			latestSceneStats,
			clientSceneBytes: sourcePackageBytes,
			clientTextureBytes: textureBytes
		})
		return
	}

	const inferredPreset = inferOptimizationPreset(persistedOptimizationSettings)

	setOptimizationState((prev) => ({
		...prev,
		optimizationPreset: inferredPreset,
		optimizations: persistedOptimizationSettings
	}))

	setOptimizationRuntime((prev) => ({
		...prev,
		isPending: false,
		isSceneSizeLoading: false,
		optimizedSceneBytes: null,
		optimizedTextureBytes: null,
		clientSceneBytes: sourcePackageBytes,
		clientTextureBytes: textureBytes,
		latestSceneStats
	}))
}
